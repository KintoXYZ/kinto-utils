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
exports.extractArgTypes = exports.estimateGas = exports.whitelistApp = exports.deployOnKinto = exports.handleOps = exports.setFunderWhitelist = exports.isKinto = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const signature_1 = require("./utils/signature");
const constants_1 = require("./utils/constants");
const crypto_1 = require("crypto");
// gas estimation helpers
const COST_OF_POST = (0, utils_1.parseUnits)("200000", "wei");
// deployer utils
const deployOnKinto = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { chainId, kintoWalletAddr, bytecode, abi, argTypes, args, privateKeys, } = params;
    let contractAddr;
    // if the contract inherits from Socket's custom 2-step Ownable contract, we deploy it via KintoDeployer
    if (abi && (yield isOwnable(abi))) {
        const params = {
            kintoWalletAddr,
            bytecode,
            abi,
            argTypes,
            args,
            privateKeys,
            chainId,
        };
        contractAddr = yield deployWithDeployer(params);
    }
    else {
        // otherwise, we deploy it via Kinto's factory
        const params = {
            kintoWalletAddr,
            bytecode,
            argTypes,
            args,
            privateKey: privateKeys[0], // use the first private key to deploy using factory
            chainId,
        };
        contractAddr = yield deployWithKintoFactory(params);
    }
    // whitelist contract on Socket's kinto wallet
    yield whitelistApp(kintoWalletAddr, contractAddr, privateKeys, chainId);
    return contractAddr;
});
exports.deployOnKinto = deployOnKinto;
const deployWithDeployer = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { kintoWalletAddr, bytecode, abi, argTypes, args, privateKeys, chainId = "7887", paymasterAddr = "0x", } = params;
    const config = constants_1.kintoConfig[chainId];
    const { contracts: kinto } = config;
    const signer = new ethers_1.Wallet(privateKeys[0], (0, signature_1.getKintoProvider)(chainId));
    // Using custom deployer that knows how to transfer ownership
    const deployer = config.contracts.deployer.address;
    console.log(`Deployer address: ${deployer}`);
    const kintoWallet = new ethers_1.ethers.Contract(kintoWalletAddr, kinto.kintoWallet.abi, signer);
    console.log(`\nDeploying contract via deployer @ ${deployer} handleOps from Kinto Wallet @ ${kintoWallet.address} and signer @ ${signer.address}`);
    //// (1). deploy contract
    // generate bytecode to deploy contract
    let encodedArgs = "";
    if (args && argTypes) {
        console.log(`- Contract will be deployed with args`, args);
        encodedArgs = utils_1.defaultAbiCoder.encode(argTypes, args).substring(2); // encode & remove '0x' prefix
    }
    else {
        console.log(`- Contract will be deployed without args`);
    }
    const bytecodeWithConstructor = bytecode + encodedArgs;
    // encode the deployer `deploy` call
    const salt = (0, crypto_1.randomBytes)(32);
    // const salt: BytesLike = ethers.utils.hexZeroPad("0x", 32);
    const deployerInterface = new utils_1.Interface(kinto.deployer.abi);
    const deployCalldata = deployerInterface.encodeFunctionData("deploy", [
        kintoWallet.address,
        bytecodeWithConstructor,
        salt,
    ]);
    // encode KintoWallet's `execute` call
    const kintoWalletInterface = new utils_1.Interface(kinto.kintoWallet.abi);
    let callData = kintoWalletInterface.encodeFunctionData("execute", [
        deployer,
        0,
        deployCalldata,
    ]);
    let nonce = yield kintoWallet.getNonce();
    const userOps = [];
    userOps[0] = yield createUserOp({
        chainId,
        sender: kintoWallet.address,
        paymaster: paymasterAddr,
        nonce,
        callData,
        privateKeys,
    });
    // compute the contract address
    const contractAddr = (0, utils_1.getCreate2Address)(deployer, salt, (0, utils_1.keccak256)(bytecodeWithConstructor));
    if (yield needsNomination(abi)) {
        console.log(`- Contract will nominate ${kintoWallet.address} for ownership`);
        //// (2). whitelist the contract
        // encode KintoWallet's `whitelistApp` call
        const whitelistAppCalldata = kintoWalletInterface.encodeFunctionData("whitelistApp", [[contractAddr], [true]]);
        // encode the KintoWallet `execute` call
        nonce = nonce.add(1);
        callData = kintoWalletInterface.encodeFunctionData("execute", [
            kintoWallet.address,
            0,
            whitelistAppCalldata,
        ]);
        userOps[1] = yield createUserOp({
            chainId,
            sender: kintoWallet.address,
            paymaster: paymasterAddr,
            nonce,
            callData,
            privateKeys,
        });
        //// (3). claim ownership
        const iface = new utils_1.Interface(abi);
        const claimOwnerCalldata = iface.encodeFunctionData("claimOwner()");
        // encode the KintoWallet `execute` call
        nonce = nonce.add(1);
        callData = kintoWalletInterface.encodeFunctionData("execute", [
            contractAddr,
            0,
            claimOwnerCalldata,
        ]);
        userOps[2] = yield createUserOp({
            chainId,
            sender: kintoWallet.address,
            paymaster: paymasterAddr,
            nonce,
            callData,
            privateKeys,
        });
    }
    // submit user operation to the EntryPoint
    yield handleOps({ kintoWalletAddr, userOps, privateKeys, chainId });
    console.log(`- Contract deployed @ ${contractAddr}`);
    try {
        const abi = ["function owner() view returns (address)"];
        const contract = new ethers_1.ethers.Contract(contractAddr, abi, signer);
        const owner = yield contract.owner();
        console.log(`- Contract owner is ${owner}`);
    }
    catch (error) {
        console.error("Error getting owner:", error);
    }
    return contractAddr;
});
const deployWithKintoFactory = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { kintoWalletAddr, bytecode, argTypes, args, privateKey, chainId = "7887", } = params;
    const config = constants_1.kintoConfig[chainId];
    const signer = new ethers_1.Wallet(privateKey, (0, signature_1.getKintoProvider)(chainId));
    console.log(`\nDeploying contract using Kinto's factory`);
    console.log(`- Contract will be deployed using signer @ ${signer.address}`);
    const factory = new ethers_1.ethers.Contract(config.contracts.factory.address, config.contracts.factory.abi, signer);
    // prepare constructor arguments and encode them along with the bytecode
    let encodedArgs = "";
    if (args && argTypes) {
        console.log("- Contract will be deployed with args", args);
        encodedArgs = utils_1.defaultAbiCoder.encode(argTypes, args).substring(2); //remove the '0x' prefix
    }
    else {
        console.log("- Contract will be deployed without args");
    }
    const bytecodeWithConstructor = bytecode + encodedArgs;
    const salt = (0, crypto_1.randomBytes)(32);
    // const salt: BytesLike = ethers.utils.hexZeroPad("0x", 32);
    // deploy contract using Kinto's factory
    const create2Address = (0, utils_1.getCreate2Address)(factory.address, salt, (0, utils_1.keccak256)(bytecodeWithConstructor));
    yield (yield factory.deployContract(kintoWalletAddr, // owner if contract is Ownable
    0, bytecodeWithConstructor, salt)).wait();
    console.log("- Contract deployed @", create2Address);
    return create2Address;
});
// other utils
const isKinto = (chainId) => Object.keys(constants_1.kintoConfig).includes(chainId.toString());
exports.isKinto = isKinto;
// can be called either with populated transactions or user operations
// populated transactions will be converted to user operations
const handleOps = (params) => __awaiter(void 0, void 0, void 0, function* () {
    let { kintoWalletAddr, userOps, privateKeys, chainId = "7887", values = [], gasParams = {}, paymasterAddr, } = params;
    const { contracts: kinto } = constants_1.kintoConfig[chainId];
    const signer = new ethers_1.Wallet(privateKeys[0], (0, signature_1.getKintoProvider)(chainId));
    const entryPoint = new ethers_1.ethers.Contract(kinto.entryPoint.address, kinto.entryPoint.abi, signer);
    const kintoWallet = new ethers_1.ethers.Contract(kintoWalletAddr, kinto.kintoWallet.abi, signer);
    const kintoWalletInterface = new utils_1.Interface(kinto.kintoWallet.abi);
    checkGas(paymasterAddr || kintoWalletAddr, userOps.length, !!paymasterAddr, chainId);
    // convert into UserOperation array if not already
    if (!isUserOpArray(userOps)) {
        // encode the contract function to be called
        const ops = [];
        let nonce = yield kintoWallet.getNonce();
        for (let i = 0; i < userOps.length; i++) {
            const callData = kintoWalletInterface.encodeFunctionData("execute", [
                userOps[i].to,
                values.length > 0
                    ? ethers_1.ethers.utils.hexlify(values[i])
                    : ethers_1.ethers.utils.hexlify(0),
                userOps[i].data,
            ]);
            ops[i] = yield createUserOp({
                chainId,
                sender: kintoWallet.address,
                paymaster: paymasterAddr || "0x",
                nonce,
                callData,
                privateKeys,
            });
            nonce = nonce.add(1);
        }
        userOps = ops;
    }
    const txResponse = yield entryPoint.handleOps(userOps, yield signer.getAddress(), Object.assign(Object.assign({}, gasParams), { type: 1 }));
    const receipt = yield txResponse.wait();
    if (hasErrors(receipt))
        throw new Error("There were errors while executing the handleOps. Check the logs.");
    return receipt;
});
exports.handleOps = handleOps;
const whitelistApp = (kintoWalletAddr_1, app_1, privateKeys_1, ...args_1) => __awaiter(void 0, [kintoWalletAddr_1, app_1, privateKeys_1, ...args_1], void 0, function* (kintoWalletAddr, app, privateKeys, chainId = "7887") {
    console.log(`\nWhitelisting contract on Kinto Wallet...`);
    const { contracts: kinto } = constants_1.kintoConfig[chainId];
    const kintoWallet = new ethers_1.ethers.Contract(kintoWalletAddr, kinto.kintoWallet.abi, (0, signature_1.getKintoProvider)(chainId));
    if (yield kintoWallet.appWhitelist(app)) {
        console.log(`- Contract is already whitelisted on Kinto Wallet`);
        return;
    }
    else {
        const txRequest = yield kintoWallet.populateTransaction.whitelistApp([app], [true], {
            gasLimit: 4000000,
        });
        const tx = yield handleOps({
            kintoWalletAddr,
            userOps: [txRequest],
            privateKeys,
            chainId,
        });
        console.log(`- Contract succesfully whitelisted on Kinto Wallet`);
        return tx;
    }
});
exports.whitelistApp = whitelistApp;
const setFunderWhitelist = (kintoWalletAddr, funders, isWhitelisted, provider, privateKeys, chainId) => __awaiter(void 0, void 0, void 0, function* () {
    const { contracts: kinto } = constants_1.kintoConfig[chainId];
    const kintoWallet = new ethers_1.ethers.Contract(kintoWalletAddr, kinto.kintoWallet.abi, provider);
    console.log(`\nUpdating funders whitelist on Kinto Wallet...`);
    // for each funder, check which ones are not whitelistd (isFunderWhitelisted)
    // and add them to an array to be passed to setFunderWhitelist
    for (let i = 0; i < funders.length; i++) {
        if ((yield kintoWallet.isFunderWhitelisted(funders[i])) === isWhitelisted[i]) {
            console.log(`- Funder ${funders[i]} is already ${isWhitelisted[i] ? "whitelisted" : "blacklisted"}. Skipping...`);
            funders.splice(i, 1);
            isWhitelisted.splice(i, 1);
        }
        else {
            console.log(`- Funder ${funders[i]} will be ${isWhitelisted[i] ? "whitelisted" : "blacklisted"}`);
        }
    }
    // "function setFunderWhitelist(address[] calldata newWhitelist, bool[] calldata flags)",
    const txRequest = yield kintoWallet.populateTransaction.setFunderWhitelist(funders, isWhitelisted);
    const tx = yield handleOps({
        kintoWalletAddr,
        userOps: [txRequest],
        privateKeys,
        chainId,
    });
    console.log(`- Funders whitelist succesfully updated`);
    return tx;
});
exports.setFunderWhitelist = setFunderWhitelist;
// check if the contract inherits from Socket's custom 2-step Ownable contract
const isOwnable = (abi) => __awaiter(void 0, void 0, void 0, function* () {
    const hasOwner = abi.some((item) => item.name === "owner");
    const hasNominateOwner = abi.some((item) => item.name === "nominateOwner");
    // const hasTransferOwnership = abi.some((item) => item.name === "transferOwnership");
    return hasOwner && hasNominateOwner;
});
const needsNomination = (abi) => __awaiter(void 0, void 0, void 0, function* () {
    // possible owner parameter names
    const ownerParams = ["owner", "_owner", "owner_"];
    // find the constructor and check for any of the owner parameter names
    const hasOwnerParam = abi.some((item) => {
        return (item.type === "constructor" &&
            item.inputs.some((input) => ownerParams.includes(input.name)));
    });
    // if the constructor has an owner parameter, we don't need to call nominate since we pass the owner directly
    return !hasOwnerParam;
});
function isUserOpArray(array) {
    return array.every((item) => item.hasOwnProperty("sender") && item.hasOwnProperty("nonce"));
}
const createUserOp = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { chainId = "7887", sender, paymaster, nonce, callData, privateKeys, } = params;
    const { callGasLimit, verificationGasLimit, preVerificationGas } = constants_1.kintoConfig[chainId].userOpGasParams;
    const userOp = {
        sender,
        nonce,
        initCode: (0, utils_1.hexlify)([]),
        callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        maxFeePerGas: (0, utils_1.parseUnits)("1", "gwei"),
        maxPriorityFeePerGas: (0, utils_1.parseUnits)("1", "gwei"),
        paymasterAndData: paymaster,
        signature: (0, utils_1.hexlify)([]),
    };
    const signature = yield (0, signature_1.signUserOp)(sender, userOp, chainId, privateKeys);
    userOp.signature = signature;
    return userOp;
});
const hasErrors = (tx) => {
    const eventSignature = "UserOperationRevertReason(bytes32,address,uint256,bytes)";
    const eventTopic = (0, utils_1.id)(eventSignature); // hash of the event
    const eventLog = tx.logs.find((log) => log.topics[0] === eventTopic);
    if (eventLog) {
        const types = [
            "uint256", // nonce
            "bytes", // revertReason
        ];
        // decode the data
        try {
            const decoded = ethers_1.ethers.utils.defaultAbiCoder.decode(types, eventLog.data);
            console.log("Revert Reason (hex):", ethers_1.ethers.utils.hexlify(decoded[1]));
        }
        catch (error) {
            console.error("Error decoding data:", error);
        }
        return true;
    }
    return false;
};
const checkGas = (contractAddr, opsLength, isPaymaster, chainId) => __awaiter(void 0, void 0, void 0, function* () {
    const contract = new ethers_1.ethers.Contract(contractAddr, [], (0, signature_1.getKintoProvider)(chainId));
    const userOpGasParams = constants_1.kintoConfig[chainId].userOpGasParams;
    const provider = contract.provider;
    const feeData = yield provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    if (!maxFeePerGas) {
        console.error("Error getting maxFeePerGas from provider");
        return;
    }
    const requiredPrefund = calculateRequiredPrefund(userOpGasParams, maxFeePerGas);
    const ethMaxCost = calculateEthMaxCost(requiredPrefund, maxFeePerGas).mul(opsLength);
    const contractBalance = yield yield provider.getBalance(contract.address);
    if (contractBalance.lt(ethMaxCost))
        throw new Error(`${isPaymaster ? "Paymaster" : "Kinto Wallet"} @ ${contractAddr} balance ${contractBalance} is less than the required ETH max cost ${ethMaxCost.toString()}`);
});
const calculateRequiredPrefund = (gasParams, maxFeePerGas, multiplier = 1 // 2 if paymaster is used
) => {
    const { callGasLimit, verificationGasLimit, preVerificationGas } = gasParams;
    const requiredGas = callGasLimit + verificationGasLimit * multiplier + preVerificationGas;
    const requiredPrefund = ethers_1.BigNumber.from(requiredGas).mul(maxFeePerGas);
    return requiredPrefund;
};
const calculateEthMaxCost = (requiredPrefund, maxFeePerGas) => requiredPrefund.add(COST_OF_POST.mul(maxFeePerGas));
const estimateGas = (provider, entryPoint, userOps) => __awaiter(void 0, void 0, void 0, function* () {
    const feeData = yield provider.getFeeData();
    const gasLimit = yield entryPoint.estimateGas.handleOps(userOps, yield entryPoint.signer.getAddress());
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    const maxFeePerGas = feeData.maxFeePerGas;
    const gasParams = {
        gasLimit: gasLimit || ethers_1.BigNumber.from("400000000"),
        maxPriorityFeePerGas: maxPriorityFeePerGas || (0, utils_1.parseUnits)("1.1", "gwei"),
        maxFeePerGas: maxFeePerGas || (0, utils_1.parseUnits)("1.1", "gwei"),
    };
    const txCost = gasParams.gasLimit.mul(gasParams.maxFeePerGas);
    console.log("- Estimated gas cost (ETH):", ethers_1.ethers.utils.formatEther(txCost));
    return gasParams;
});
exports.estimateGas = estimateGas;
// extract argument types from constructor
const extractArgTypes = (abi) => __awaiter(void 0, void 0, void 0, function* () {
    const constructorAbi = abi.find((element) => element.type === "constructor");
    let argTypes = [];
    if (constructorAbi && constructorAbi.inputs.length > 0) {
        argTypes = constructorAbi.inputs.map((input) => input.type);
    }
    return argTypes;
});
exports.extractArgTypes = extractArgTypes;
