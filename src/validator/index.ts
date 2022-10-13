import express from "express";
import { wallet } from "../wallet/wallet";
import { Transaction, TransactionRequest } from "../types";
import fs from "fs";
import path from "path";
import sha256 from "sha256";
import crypto from "crypto";
import { Block, WalletState } from "../types";
import NodeRSA from "node-rsa";
import fetch from "node-fetch";

class Validator {
  public app: express.Application;
  public port: number;

  constructor() {
    this.app = express();
    this.app.use(express.json());

    this.port = 2828;

    this.app.post("/transaction", this.handleTransaction);

    // Other validators have to request entire chain state to validate it
    this.app.get("/chain", this.announceChain);

    this.app.listen(this.port);
  }

  private chianIsValid(chainState: Block[]) {
    // Check if the chain is valid
    for (let i = 1; i < chainState.length; i++) {
      let block = chainState[i];
      let prevBlock = chainState[i - 1];

      // prevBlockHash matches the hash of the previous block
      if (
        block.prevBlockHash !=
        sha256(
          prevBlock.prevBlockHash +
            prevBlock.blockNumber.toString() +
            prevBlock.transactionHashed +
            prevBlock.blockNonce
        )
      ) {
        return false;
      }

      // Todo: keep track of the state over the entire chain and check if transactions are valid by iterating over each transaction

      let transactionsHash = this.hashTransactions(block.transactions);

      // Hash of the current block is correctly compiled
      let blockHash = sha256(
        prevBlock.blockHash +
          block.blockNumber.toString() +
          transactionsHash +
          block.blockNonce
      );

      if (blockHash != block.blockHash) {
        return false;
      }
    }

    return true;
  }

  public async getChain() {
    // Fetch chain state
    let chainState: Block[] = await fetch("http://localhost:2828/chain").then(
      (res: any): Promise<Block[]> => res.json()
    );

    if (this.chianIsValid(chainState)) {
      console.log("Chain is valid");

      // Todo: update only if the chain is longer than the current one
      // Write chain state
      fs.writeFileSync(
        path.join(__dirname, "..", "state", "chain.json"),
        JSON.stringify(chainState, null, 2)
      );
    } else {
      console.log("Chain is not valid");
    }
  }

  private announceChain(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    // Get chain state
    let chainState: Block[] = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "state", "chain.json"), "utf8")
    );

    // Return chian state
    // Todo: split response to multiple requests
    res.send(chainState);
  }

  private hashTransactions(transactions: Transaction[]) {
    let hash = "";
    for (let transaction of transactions) {
      hash +=
        transaction.fromAddress +
        transaction.toAddress +
        transaction.amount.toString() +
        transaction.nonce.toString();
    }
    return sha256(hash);
  }

  private mintNewBlock() {
    // Open chain state file
    let chainState: Block[] = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "state", "chain.json"), "utf8")
    );

    // Hash transactions in the last block
    let transactions = chainState[chainState.length - 1].transactions;
    let transactionsHash = this.hashTransactions(transactions);

    let prevBlockHash = chainState[chainState.length - 1].prevBlockHash;
    let blockNumber = chainState[chainState.length - 1].blockNumber;

    // Nonce can be any 50 digit number
    // find a nonce that hashes to a string that starts with 0
    let nonce = "";
    while (nonce == "") {
      let nonceCandidate = crypto.randomBytes(50).toString("hex");
      let blockHash = sha256(
        prevBlockHash +
          blockNumber.toString() +
          transactionsHash +
          nonceCandidate
      );

      if (blockHash.substring(0, 1) == "0") {
        nonce = nonceCandidate;
      }
    }

    // Set block nonce, transactionsHashed and blockHash
    chainState[chainState.length - 1].blockNonce = nonce;
    chainState[chainState.length - 1].transactionHashed = transactionsHash;
    chainState[chainState.length - 1].blockHash = sha256(
      prevBlockHash + blockNumber.toString() + transactionsHash + nonce
    );

    // Add new block to the chain
    chainState.push({
      blockNumber: blockNumber + 1,
      transactions: [],
      prevBlockHash: chainState[chainState.length - 1].blockHash,
      transactionHashed: "",
      blockNonce: "",
      blockHash: "",
    });

    // Write chain state
    fs.writeFileSync(
      path.join(__dirname, "..", "state", "chain.json"),
      JSON.stringify(chainState, null, 2)
    );

    // Todo: broadcast new block to other validators
  }

  private addTransactionToChain(transaction: Transaction) {
    // Open chain state file
    let chainState = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "state", "chain.json"), "utf8")
    );

    // Add transaction to the last block
    chainState[chainState.length - 1].transactions.push(transaction);

    // Write chain state
    fs.writeFileSync(
      path.join(__dirname, "..", "state", "chain.json"),
      JSON.stringify(chainState)
    );

    // Check if there are more than 10 transactions in the last block
    if (chainState[chainState.length - 1].transactions.length > 10) {
      this.mintNewBlock();
    }
  }

  private changeWalletState(transaction: Transaction) {
    // Write wallet state
    let walletState = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "state", "wallets.json"),
        "utf8"
      )
    );

    // Update balances and nonces
    walletState[transaction.fromAddress].nonce += 1;
    walletState[transaction.fromAddress].balance -= transaction.amount;
    walletState[transaction.toAddress].balance += transaction.amount;

    // Change the wallets state
    fs.writeFileSync(
      path.join(__dirname, "..", "state", "wallets.json"),
      JSON.stringify(walletState)
    );

    return true;
  }

  public handleTransaction(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let transactionRequest: TransactionRequest = req.body;

    // Validates the transaction
    let isValid = wallet.validateTransaction(
      transactionRequest.sender,
      transactionRequest.encryptedTransaction,
      transactionRequest.plaintextTransaction
    );

    if (!isValid) {
      // Reject transaction
      res.status(400).json({
        success: false,
      });
      return;
    }

    // Accept transaction
    this.changeWalletState(transactionRequest.plaintextTransaction);

    this.addTransactionToChain(transactionRequest.plaintextTransaction);
  }
}

export default Validator;
