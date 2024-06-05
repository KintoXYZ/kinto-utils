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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sign = exports.signUserOp = exports.getKintoProvider = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const constants_1 = require("./constants");
const trezorProvider_1 = __importDefault(require("./trezorProvider"));
const signer_ledger_1 = require("@ethers-ext/signer-ledger");
const hw_transport_node_hid_1 = __importDefault(require("@ledgerhq/hw-transport-node-hid"));
const constants_2 = require("./constants");
const packUserOpForSig = (userOp) => {
    return utils_1.defaultAbiCoder.encode([
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
    ], [
        userOp.sender,
        userOp.nonce,
        (0, utils_1.keccak256)(userOp.initCode),
        (0, utils_1.keccak256)(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        (0, utils_1.keccak256)(userOp.paymasterAndData),
    ]);
};
const getUserOpHash = (userOp, chainId) => __awaiter(void 0, void 0, void 0, function* () {
    const packedForSig = packUserOpForSig(userOp);
    const opHash = (0, utils_1.keccak256)(packedForSig);
    return (0, utils_1.keccak256)(utils_1.defaultAbiCoder.encode(["bytes32", "address", "uint256"], [opHash, constants_2.kintoConfig[chainId].contracts.entryPoint.address, chainId]));
});
const signUserOp = (kintoWalletAddr, userOp, chainId, privateKeys) => __awaiter(void 0, void 0, void 0, function* () {
    const provider = getKintoProvider(chainId);
    const kintoWallet = new ethers_1.ethers.Contract(kintoWalletAddr, constants_2.kintoConfig[chainId].contracts.kintoWallet.abi, provider);
    // prepare hash to sign
    const hash = yield getUserOpHash(userOp, chainId);
    const ethSignedHash = (0, utils_1.hashMessage)((0, utils_1.arrayify)(hash));
    // check policy and required signers
    // await checkPolicy(kintoWallet, privateKeys);
    let signature = "0x";
    for (const privateKey of privateKeys) {
        if (privateKey == constants_1.TREZOR || privateKey == constants_1.LEDGER) {
            // sign with hardware wallet if available
            const hwSignature = yield signWithHw(hash, privateKey);
            console.log("- HW signature:", hwSignature);
            signature += hwSignature;
        }
        else {
            const signingKey = new utils_1.SigningKey(privateKey);
            console.log(`\nSigning message: ${ethSignedHash} with signer: ${yield new ethers_1.ethers.Wallet(privateKey).getAddress()}...`);
            const sig = signingKey.signDigest(ethSignedHash);
            console.log("- EOA signature:", sig.compact);
            signature += (0, utils_1.joinSignature)(sig).slice(2); // remove initial '0x'
        }
    }
    return signature;
});
exports.signUserOp = signUserOp;
const signWithHw = (hash_1, hwType_1, ...args_1) => __awaiter(void 0, [hash_1, hwType_1, ...args_1], void 0, function* (hash, hwType, chainId = "7887") {
    const provider = getKintoProvider(chainId);
    const deviceName = hwType === constants_1.TREZOR ? "Trezor" : "Ledger";
    try {
        console.log(`\nUsing ${deviceName} as second signer...`);
        if (hwType === constants_1.LEDGER) {
            // @ts-ignore
            const ledger = new signer_ledger_1.LedgerSigner(hw_transport_node_hid_1.default, provider);
            const signer = yield ledger.getAddress();
            console.log(`\nSigning message: ${hash} with signer: ${signer}...`);
            console.log("If you want to use another account index, set the ACCOUNT_INDEX env variable.");
            return yield ledger.signMessage(hash);
        }
        if (hwType === constants_1.TREZOR) {
            const trezorSigner = new trezorProvider_1.default(provider);
            const signer = yield trezorSigner.getAddress();
            console.log(`\nSigning message: ${hash} with signer: ${signer}...`);
            console.log("If you want to use another account index, set the ACCOUNT_INDEX env variable.");
            return yield trezorSigner.signMessage(hash);
        }
    }
    catch (e) {
        console.error(`\nError: Could not sign with ${deviceName}.`);
        throw new Error(e.message);
    }
    console.log("\nWARNING: No hardware wallet detected.");
    return;
});
const sign = (privateKey, chainId) => __awaiter(void 0, void 0, void 0, function* () {
    const config = constants_2.kintoConfig[chainId];
    const wallet = new ethers_1.ethers.Wallet(privateKey, getKintoProvider(chainId));
    const kintoID = new ethers_1.ethers.Contract(config.contracts.kintoID.address, config.contracts.kintoID.abi, wallet);
    // const domainSeparator = await kintoID.domainSeparator();
    const domain = {
        name: "KintoID",
        version: "1",
        chainId,
        verifyingContract: config.contracts.kintoID.address,
    };
    const types = {
        SignatureData: [
            { name: "signer", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "expiresAt", type: "uint256" },
        ],
    };
    const value = {
        signer: wallet.address,
        nonce: yield kintoID.nonces(wallet.address),
        expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours expiry
    };
    const signature = yield wallet._signTypedData(domain, types, value);
    console.log("Signature results:", {
        value,
        signature,
    });
    return signature;
});
exports.sign = sign;
const getKintoProvider = (chainId = "7887") => {
    return new ethers_1.ethers.providers.StaticJsonRpcProvider(constants_2.kintoConfig[chainId].rpcUrl);
};
exports.getKintoProvider = getKintoProvider;
const checkPolicy = (kintoWallet, privateKeys) => __awaiter(void 0, void 0, void 0, function* () {
    const policy = yield kintoWallet.signerPolicy();
    const ownersLength = yield kintoWallet.getOwnersCount();
    const requiredSigners = policy == 3 ? ownersLength : policy == 1 ? 1 : ownersLength - 1;
    if (privateKeys.length < requiredSigners) {
        throw new Error(`Not enough private keys provided. Required ${requiredSigners}, got ${privateKeys.length}`);
    }
});
