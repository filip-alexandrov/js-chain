import Wallet from "./wallet/initWallet";

let wallet = new Wallet();


// generate 100 word string
let randomString = "";
for (let i = 0; i < 100; i++) {
    randomString += Math.random().toString(36).substring(2);
}

let encryptedMessage = wallet.encryptMessage(randomString);

console.log("Encrypted message: " + encryptedMessage);

let resp = wallet.validateMessageFromAddress(wallet.publicKey, encryptedMessage, randomString);

console.log(resp);