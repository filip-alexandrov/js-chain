import Wallet from "./wallet/wallet";

let wallet = new Wallet();


let toEncrypt = {"random string" : "hello world"}; 

let encryptedMessage = wallet.encryptMessage(toEncrypt);


let resp = wallet.validateMessageFromAddress(wallet.address, encryptedMessage, toEncrypt);

console.log(resp)