import NodeRSA from "node-rsa";
import fs from "fs";
import path from "path";
import sha256 from "sha256";

class Wallet {
  public publicKey: string;
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
        this.privateKey.exportKey("private")
      );

      // Save the public key
      fs.writeFileSync(
        path.join(__dirname, "keys", "public.pem"),
        this.privateKey.exportKey("public")
      );
    }
  }

  // Encrypts a message with the private key (can be validated by anyone with the public key)
  encryptMessage(message: string): string {
    // Encrypt message with private key
    let encrypted = this.privateKey.encryptPrivate(message, "base64");

    return encrypted;
  }

  // Validates a plaintext message that was encrypted with a private key of an address
  validateMessageFromAddress(
    senderAddress: string,
    encryptedMessage: string,
    unencryptedMessage: string
  ): boolean {
    // Create a new instance of NodeRSA with the public key (address)
    let pubKey = new NodeRSA(senderAddress);
    let decrypted = pubKey.decryptPublic(encryptedMessage, "utf8");

    if (decrypted == unencryptedMessage) {
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
}

export default Wallet;
