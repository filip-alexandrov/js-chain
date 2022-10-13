import Validator from "./validator";
import {wallet} from "./wallet/wallet";

let validator = new Validator(); 


let toEncrypt = {"random string" : "hello world"}; 

let encryptedMessage = wallet.encryptMessage(toEncrypt);


wallet.sendTransaction("948203", 100);
