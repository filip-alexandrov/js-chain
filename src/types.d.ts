export interface Transaction {
  fromAddress: string;
  toAddress: string;
  amount: number;
  nonce: number;
}

export interface TransactionRequest {
  sender: string;
  encryptedTransaction: string;
  plaintextTransaction: Transaction;
}

export interface WalletState {
  [key: string]: {
    nonce: number;
    balance: number;
  };
}

export interface TransactionResponse {
  success: boolean;
}

export interface Block {
    blockNumber: number;
    transactions: Transaction[];
    prevBlockHash: string;
    transactionHashed: string;
    blockNonce: string; 
    blockHash: string;
}
