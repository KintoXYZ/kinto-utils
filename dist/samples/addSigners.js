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
// sample on how to add a signer to KintoWallet
(() => __awaiter(void 0, void 0, void 0, function* () {
    const NEW_SIGNER = "";
    if (!NEW_SIGNER || NEW_SIGNER === "")
        throw new Error("NEW_SIGNER missing");
    if (!process.env.PRIVATE_KEY)
        throw new Error("PRIVATE_KEY missing");
    if (!process.env.KINTO_WALLET)
        throw new Error("KINTO_WALLET missing");
    const privateKeys = [process.env.PRIVATE_KEY, constants_1.TREZOR];
    const kintoWalletAddr = process.env.KINTO_WALLET;
    // get KintoWallet instance
    const abi = [
        "function resetSigners(address[] calldata newSigners, uint8 policy) external",
        "function owners(uint256) view returns (address)",
        "function getOwnersCount() view returns (uint256)",
    ];
    const wallet = new ethers_1.ethers.Contract(kintoWalletAddr, abi, (0, signature_1.getKintoProvider)("7887"));
    // get current owners
    const ownersCount = yield wallet.getOwnersCount();
    console.log(`- Owners count: ${ownersCount}`);
    let owners = [];
    for (let i = 0; i < ownersCount; i++) {
        const owner = yield wallet.owners(i);
        owners.push(owner);
        console.log(`- Owner[${i}]: ${owner}`);
    }
    // add a new signer
    owners.push(NEW_SIGNER);
    const tx = yield wallet.populateTransaction.resetSigners(owners, 2);
    const params = {
        kintoWalletAddr,
        userOps: [tx],
        privateKeys,
        // gasParams: { gasLimit: BigNumber.from("4000000") }
    };
    console.log(`- Adding ${NEW_SIGNER} as new signer on KintoWallet...`);
    yield (0, kinto_1.handleOps)(params);
    console.log(`- Owners count: ${yield wallet.getOwnersCount()}`);
}))();
