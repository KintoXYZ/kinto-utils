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
    // function resetSigners(address[] calldata newSigners, uint8 policy) external;
    const privateKeys = [process.env.PRIVATE_KEY, constants_1.TREZOR];
    const kintoWalletAddr = "0x7403542bF2aF061eBF0DC16cAfA3068b90Fc1e75";
    const abi = [
        "function resetSigners(address[] calldata newSigners, uint8 policy) external",
        "function owners(uint256) view returns (address)",
        "function getOwnersCount() view returns (uint256)",
    ];
    const wallet = new ethers_1.ethers.Contract(kintoWalletAddr, abi, (0, signature_1.getKintoProvider)("7887"));
    const ownersCount = yield wallet.getOwnersCount();
    console.log(`- Owners count: ${ownersCount}`);
    let owners = [];
    for (let i = 0; i < ownersCount; i++) {
        const owner = yield wallet.owners(i);
        owners.push(owner);
        console.log(`- Owner[${i}]: ${owner}`);
    }
    owners.push("0x90E10C37d8d9e854e7775B0069728642A1F88610"); // ledger
    const tx = yield wallet.populateTransaction.resetSigners(owners, 2);
    const params = {
        kintoWalletAddr: "0x7403542bF2aF061eBF0DC16cAfA3068b90Fc1e75",
        userOps: [tx],
        privateKeys,
        // gasParams: { gasLimit: BigNumber.from("4000000") }
    };
    console.log(`- Resetting signers count...`);
    yield (0, kinto_1.handleOps)(params);
    console.log(`- Owners count: ${yield wallet.getOwnersCount()}`);
}))();
