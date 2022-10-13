import NodeRSA from "node-rsa";
import fs from "fs";
import path from "path";
import sha256 from "sha256";
import fetch from "isomorphic-fetch";
import { Transaction, WalletState, TransactionResponse } from "../types";

class Wallet {
  public publicKey: string;
  public address: string;

  private privateKey: NodeRSA;

  public constructor() {
    try {
      console.log("Reading private key from file");

      // Get already generated private key
      let utfEncodedKey = fs.readFileSync(
        path.join(__dirname, "keys", "private.pem"),
        "utf8"
      );

      // Create a new instance of NodeRSA with the private key
      this.privateKey = new NodeRSA(utfEncodedKey);

      // Check if key length is 512 bits
      if (this.privateKey.getKeySize() != 512) {
        throw new Error("Private key length is not 256 bits");
      }

      this.publicKey = this.privateKey.exportKey("public");

      console.log("Private key read successfully");
    } catch (err) {
      console.log("Generating new private key");

      // If there is no private key, generate one (512 bit length)
      this.privateKey = new NodeRSA({ b: 512 });
      this.publicKey = this.privateKey.exportKey("public");
      // Create folder "keys" if it doesn't exist
      if (!fs.existsSync(path.join(__dirname, "keys"))) {
        fs.mkdirSync(path.join(__dirname, "keys"));
      }

      // Save the private key
      fs.writeFileSync(
        path.join(__dirname, "keys", "private.pem"),
        this.privateKey.exportKey()
      );

      // Save the public key
      fs.writeFileSync(
        path.join(__dirname, "keys", "public.pem"),
        this.privateKey.exportKey()
      );
    }

    // Generate address from public key (remove newlines and RSA header/footer)
    this.address = this.publicKey
      .replace(/(\r\n|\n|\r)/gm, "")
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "");
  }

  // Encrypts a message with the private key (can be validated by anyone with the public key)
  encryptMessage(message: object): string {
    // Encrypt message with private key
    let encrypted = this.privateKey.encryptPrivate(message, "base64");

    return encrypted;
  }

  // Validates a plaintext message that was encrypted with a private key of an address
  validateTransaction(
    senderAddress: string,
    encryptedMessage: string,
    unencryptedMessage: Transaction
  ): boolean {
    // Create a new instance of NodeRSA with the public key (address)
    let pubKey = new NodeRSA(senderAddress, "pkcs8-public");
    let decrypted: Transaction = JSON.parse(
      pubKey.decryptPublic(encryptedMessage, "utf8")
    );

    // Read wallet state
    let walletState: WalletState = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "state", "wallets.json"),
        "utf8"
      )
    );

    let targetNonce = walletState[this.address]?.nonce + 1;

    // Check if sender has enough balance
    let hasEnoughBalance = false;
    if (walletState[senderAddress]?.balance < unencryptedMessage.amount) {
      hasEnoughBalance = false;
    } else {
      hasEnoughBalance = true;
    }

    // Correctly encrypted message
    if (
      decrypted.amount == unencryptedMessage.amount &&
      decrypted.fromAddress == unencryptedMessage.fromAddress &&
      decrypted.toAddress == unencryptedMessage.toAddress &&
      decrypted.nonce == unencryptedMessage.nonce &&
      decrypted.nonce == targetNonce &&
      hasEnoughBalance
    ) {
      console.log(
        "Received message matches the encrypted message. Public address possesses the private key"
      );
      return true;
    }

    console.log(
      "Received message does not match the encrypted message. Public address does not possess the private key"
    );
    return false;
  }

  sendTransaction(toAddress: string, amount: number) {
    // Read wallet state
    let walletState: WalletState = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "state", "wallets.json"),
        "utf8"
      )
    );

    let transaction = {
      fromAddress: this.address,
      toAddress: toAddress,
      amount: amount,
      nonce: walletState[this.address]?.nonce + 1,
    };

    let encryptedTransaction = this.encryptMessage(transaction);

    // Send transaction to the network via POST request on port 2828
    fetch("http://localhost:2828/transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: this.address,
        encryptedTransaction,
        plaintextTransaction: transaction,
      }),
    })
      .then((res: any): Promise<TransactionResponse | any> => res.json())
      .then((json: TransactionResponse) => {
        if (json.success) {
          console.log("Transaction sent successfully");
        } else {
          console.log("Transaction failed");
        }
      });
  }

  // Submit smart contract code
  submitSmartContract(contractCode: string) {
    eval(contractCode);
  }
}

export let wallet = new Wallet();
