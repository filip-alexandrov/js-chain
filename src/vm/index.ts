import vm from "node:vm";

// State from previous executions
let state = { x: 2, y: 3 };

// Auto generated transaction details and data
let msg = { sender: "public_address", data: { arbitrary: "data" } };

// Bind other contracts state
let otherContractsState: any = {
  contract_addr1: {
    x: 19,
    y: 22,
  },
  contract_addr2: {
    x: 1,
    y: 2,
  },
};

// This code will be added to the context ahead of execution, it will always change the same vars
let extendedState: any = {
  msg,
  otherContractsState,
  state,
};

// Contextify the object.
let context = vm.createContext(extendedState);

// Code of the smart contract, immutable
let code =
  "x += 40; var y = 17; z={}; function main() { z['hello'] = otherContractsState['contract_addr1'].getRandomNumber(); return x + y; }";

// Execute main function of the smart contract
code = code + "main()";

// Execute the code within context
vm.runInContext(code, context, { timeout: 10 });

console.log(JSON.stringify(context)); // new context

// Update the context on chain, smart contract code remains the same
