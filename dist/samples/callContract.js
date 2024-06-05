"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
require("../kinto");
const kinto_1 = require("../kinto");
const constants_1 = require("../utils/constants");
const signature_1 = require("../utils/signature");
// sample on how to deploy a Counter contract
(() => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.PRIVATE_KEY)
        throw new Error("PRIVATE_KEY missing");
    // Counter contract bytecode
    const privateKeys = [process.env.PRIVATE_KEY, constants_1.TREZOR];
    const counterAddr = "0x5c761ED8FDcC729be29C0f63c84B3Cc9256bc68C";
    const abi = [
        "function count() view returns (uint256)",
        "function increment()",
    ];
    const counter = new ethers_1.ethers.Contract(counterAddr, abi, (0, signature_1.getKintoProvider)("7887"));
    const tx = yield counter.populateTransaction.increment();
    const params = {
        kintoWalletAddr: "0x7403542bF2aF061eBF0DC16cAfA3068b90Fc1e75",
        userOps: [tx],
        privateKeys,
    };
    console.log(`- Count is: ${yield counter.count()}`);
    console.log(`- Incrementing count...`);
    yield (0, kinto_1.handleOps)(params);
    console.log(`- Count is: ${yield counter.count()}`);
}))();
