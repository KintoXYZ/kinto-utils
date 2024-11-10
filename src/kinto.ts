import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import {
  ethers,
  Wallet,
  Contract,
  BigNumber,
  PopulatedTransaction,
  providers,
} from "ethers";
import {
  defaultAbiCoder,
  keccak256,
  parseUnits,
  Interface,
  hexlify,
  id,
  getCreate2Address,
  BytesLike,
} from "ethers/lib/utils";
import {
  TransactionResponse,
  TransactionReceipt,
} from "@ethersproject/abstract-provider";
import { getKintoProvider, signUserOp } from "./utils/signature";
import {
  CreateUserOpParam,
  DeployOnKintoParams,
  DeployWithDeployerParam,
  DeployWithKintoFactoryParam,
  HandleOpsParams,
  UserOpGasParams,
  UserOperation,
} from "./utils/types";
import { kintoConfig } from "./utils/constants";
import { randomBytes } from "crypto";

// gas estimation helpers
const COST_OF_POST = parseUnits("200000", "wei");

// deployer utils
const deployOnKinto = async (params: DeployOnKintoParams): Promise<string> => {
  const {
    chainId,
    kintoWalletAddr,
    bytecode,
    abi,
    argTypes,
    args,
    privateKeys,
  } = params;
  let contractAddr: string;

  // if the contract inherits from Socket's custom 2-step Ownable contract, we deploy it via KintoDeployer
  if (abi && (await isOwnable(abi))) {
    const params: DeployWithDeployerParam = {
      kintoWalletAddr,
      bytecode,
      abi,
      argTypes,
      args,
      privateKeys,
      chainId,
    };
    contractAddr = await deployWithDeployer(params);
  } else {
    // otherwise, we deploy it via Kinto's factory
    const params: DeployWithKintoFactoryParam = {
      kintoWalletAddr,
      bytecode,
      argTypes,
      args,
      privateKey: privateKeys[0], // use the first private key to deploy using factory
      chainId,
    };
    contractAddr = await deployWithKintoFactory(params);
  }

  return contractAddr;
};

const deployWithDeployer = async (
  params: DeployWithDeployerParam
): Promise<string> => {
  const {
    kintoWalletAddr,
    bytecode,
    abi,
    argTypes,
    args,
    privateKeys,
    chainId = "7887",
    paymasterAddr = "0x",
  } = params;
  const config = kintoConfig[chainId];
  const { contracts: kinto } = config;
  const signer = new Wallet(privateKeys[0], getKintoProvider(chainId));

  // Using custom deployer that knows how to transfer ownership
  const deployer = config.contracts.deployer.address;
  console.log(`Deployer address: ${deployer}`);

  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kinto.kintoWallet.abi,
    signer
  );

  console.log(
    `\nDeploying contract via deployer @ ${deployer} handleOps from Kinto Wallet @ ${kintoWallet.address} and signer @ ${signer.address}`
  );

  //// (1). deploy contract

  // generate bytecode to deploy contract
  let encodedArgs = "";
  if (args && argTypes) {
    console.log(`- Contract will be deployed with args`, args);
    encodedArgs = defaultAbiCoder.encode(argTypes, args).substring(2); // encode & remove '0x' prefix
  } else {
    console.log(`- Contract will be deployed without args`);
  }
  const bytecodeWithConstructor = bytecode + encodedArgs;

  // encode the deployer `deploy` call
  const salt: BytesLike = randomBytes(32);
  // const salt: BytesLike = ethers.utils.hexZeroPad("0x", 32);
  const deployerInterface = new Interface(kinto.deployer.abi);
  const deployCalldata = deployerInterface.encodeFunctionData("deploy", [
    kintoWallet.address,
    bytecodeWithConstructor,
    salt,
  ]);

  // encode KintoWallet's `execute` call
  const kintoWalletInterface = new Interface(kinto.kintoWallet.abi);
  let callData = kintoWalletInterface.encodeFunctionData("execute", [
    deployer,
    0,
    deployCalldata,
  ]);

  let nonce: BigNumber = await kintoWallet.getNonce();
  const userOps = [];
  userOps[0] = await createUserOp({
    chainId,
    sender: kintoWallet.address,
    paymaster: paymasterAddr,
    nonce,
    callData,
    privateKeys,
  });

  // compute the contract address
  const contractAddr = getCreate2Address(
    deployer as string,
    salt,
    keccak256(bytecodeWithConstructor)
  );

  if (await needsNomination(abi)) {
    console.log(
      `- Contract will nominate ${kintoWallet.address} for ownership`
    );

    //// (2). whitelist the contract
    // encode KintoWallet's `whitelistApp` call
    const whitelistAppCalldata = kintoWalletInterface.encodeFunctionData(
      "whitelistApp",
      [[contractAddr], [true]]
    );

    // encode the KintoWallet `execute` call
    nonce = nonce.add(1);
    callData = kintoWalletInterface.encodeFunctionData("execute", [
      kintoWallet.address,
      0,
      whitelistAppCalldata,
    ]);
    userOps[1] = await createUserOp({
      chainId,
      sender: kintoWallet.address,
      paymaster: paymasterAddr,
      nonce,
      callData,
      privateKeys,
    });

    //// (3). claim ownership
    const iface = new Interface(abi);
    const claimOwnerCalldata = iface.encodeFunctionData("claimOwner()");

    // encode the KintoWallet `execute` call
    nonce = nonce.add(1);
    callData = kintoWalletInterface.encodeFunctionData("execute", [
      contractAddr,
      0,
      claimOwnerCalldata,
    ]);
    userOps[2] = await createUserOp({
      chainId,
      sender: kintoWallet.address,
      paymaster: paymasterAddr,
      nonce,
      callData,
      privateKeys,
    });
  }

  // submit user operation to the EntryPoint
  await handleOps({ kintoWalletAddr, userOps, privateKeys, chainId });

  console.log(`- Contract deployed @ ${contractAddr}`);
  try {
    const abi = ["function owner() view returns (address)"];
    const contract = new ethers.Contract(contractAddr, abi, signer);
    const owner = await contract.owner();
    console.log(`- Contract owner is ${owner}`);
  } catch (error) {
    console.error("Error getting owner:", error);
  }
  return contractAddr;
};

const deployWithKintoFactory = async (
  params: DeployWithKintoFactoryParam
): Promise<string> => {
  const {
    kintoWalletAddr,
    bytecode,
    argTypes,
    args,
    privateKey,
    chainId = "7887",
  } = params;
  const config = kintoConfig[chainId];
  const signer = new Wallet(privateKey, getKintoProvider(chainId));
  console.log(`\nDeploying contract using Kinto's factory`);
  console.log(`- Contract will be deployed using signer @ ${signer.address}`);
  const factory = new ethers.Contract(
    config.contracts.factory.address as string,
    config.contracts.factory.abi,
    signer
  );

  // prepare constructor arguments and encode them along with the bytecode
  let encodedArgs = "";
  if (args && argTypes) {
    console.log("- Contract will be deployed with args", args);
    encodedArgs = defaultAbiCoder.encode(argTypes, args).substring(2); //remove the '0x' prefix
  } else {
    console.log("- Contract will be deployed without args");
  }
  const bytecodeWithConstructor = bytecode + encodedArgs;

  const salt: BytesLike = randomBytes(32);
  // const salt: BytesLike = ethers.utils.hexZeroPad("0x", 32);

  // deploy contract using Kinto's factory
  const create2Address = getCreate2Address(
    factory.address,
    salt,
    keccak256(bytecodeWithConstructor)
  );
  await (
    await factory.deployContract(
      kintoWalletAddr, // owner if contract is Ownable
      0,
      bytecodeWithConstructor,
      salt
    )
  ).wait();
  console.log("- Contract deployed @", create2Address);
  return create2Address;
};

// other utils
const isKinto = (chainId: number): boolean =>
  Object.keys(kintoConfig).includes(chainId.toString());

// can be called either with populated transactions or user operations
// populated transactions will be converted to user operations
const handleOps = async (
  params: HandleOpsParams
): Promise<TransactionReceipt> => {
  let {
    kintoWalletAddr,
    userOps,
    privateKeys,
    chainId = "7887",
    values = [],
    gasParams = {},
    paymasterAddr,
  } = params;
  const { contracts: kinto } = kintoConfig[chainId];
  const signer = new Wallet(privateKeys[0], getKintoProvider(chainId));
  const signerAddress = await signer.getAddress();

  const entryPoint = new ethers.Contract(
    kinto.entryPoint.address as string,
    kinto.entryPoint.abi,
    signer
  );
  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kinto.kintoWallet.abi,
    signer
  );
  const kintoWalletInterface = new Interface(kinto.kintoWallet.abi);

  checkGas(
    paymasterAddr || kintoWalletAddr,
    userOps.length,
    !!paymasterAddr,
    chainId
  );

  const appSigner = await kintoWallet.appSigner(
    (userOps[userOps.length - 1] as PopulatedTransaction).to
  );

  // convert into UserOperation array if not already
  if (!isUserOpArray(userOps)) {
    // encode the contract function to be called
    const ops = [];
    let nonce = await kintoWallet.getNonce();
    for (let i = 0; i < userOps.length; i++) {
      const callData = kintoWalletInterface.encodeFunctionData("execute", [
        (userOps[i] as PopulatedTransaction).to,
        values.length > 0
          ? ethers.utils.hexlify(values[i])
          : ethers.utils.hexlify(0),
        (userOps[i] as PopulatedTransaction).data,
      ]);
      ops[i] = await createUserOp({
        chainId,
        sender: kintoWallet.address,
        paymaster: paymasterAddr || "0x",
        nonce,
        callData,
        privateKeys:
          appSigner === signerAddress ? [privateKeys[0]] : privateKeys,
      });
      nonce = nonce.add(1);
    }
    userOps = ops;
  }

  const txResponse: TransactionResponse = await entryPoint.handleOps(
    userOps,
    signerAddress,
    {
      ...gasParams,
      type: 1, // non EIP-1559
    }
  );
  const receipt: TransactionReceipt = await txResponse.wait();
  if (hasErrors(receipt))
    throw new Error(
      "There were errors while executing the handleOps. Check the logs."
    );
  return receipt;
};

const addAppContracts = async (
  kintoWalletAddr: string,
  app: string,
  contracts: string[],
  privateKeys: string[],
  chainId: string = "7887"
): Promise<TransactionReceipt | undefined> => {
  console.log(`\nAdding contracts to App Registry...`);
  const { contracts: kinto } = kintoConfig[chainId];

  const appRegistry = new ethers.Contract(
    kinto.appRegistry.address,
    kinto.appRegistry.abi,
    getKintoProvider(chainId)
  );

  // Check if all contracts are already registered
  const appMetadata = await appRegistry.getAppMetadata(app);
  const existingContracts = new Set(appMetadata.appContracts);
  const contractsToAdd = contracts.filter(
    (contract) => !existingContracts.has(contract)
  );

  if (contractsToAdd.length === 0) {
    console.log(`- All contracts are already registered for the app`);
    return;
  } else {
    const txRequest = await appRegistry.populateTransaction.addAppContracts(
      app,
      contractsToAdd,
      {
        gasLimit: 4_000_000,
      }
    );

    const tx = await handleOps({
      kintoWalletAddr,
      userOps: [txRequest],
      privateKeys,
      chainId,
    });

    console.log(
      `- Successfully added ${contractsToAdd.length} contracts to App Registry`
    );
    return tx;
  }
};

const whitelistAppAndSetKey = async (
  kintoWalletAddr: string,
  app: string,
  privateKeys: string[],
  chainId: string = "7887"
): Promise<TransactionReceipt | undefined> => {
  console.log(`\nWhitelisting contract and setting key on Kinto Wallet...`);
  const { contracts: kinto } = kintoConfig[chainId];

  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kinto.kintoWallet.abi,
    getKintoProvider(chainId)
  );

  if (await kintoWallet.appWhitelist(app)) {
    console.log(`- Contract is already whitelisted on Kinto Wallet`);
    return;
  } else {
    const txRequest =
      await kintoWallet.populateTransaction.whitelistAppAndSetKey(
        app,
        kintoWalletAddr, // Using KintoWallet as the signer
        {
          gasLimit: 4_000_000,
        }
      );

    const tx = await handleOps({
      kintoWalletAddr,
      userOps: [txRequest],
      privateKeys,
      chainId,
    });

    console.log(
      `- Contract successfully whitelisted and key set on Kinto Wallet`
    );
    return tx;
  }
};

const whitelistApp = async (
  kintoWalletAddr: string,
  app: string,
  privateKeys: string[],
  chainId: string = "7887"
): Promise<TransactionReceipt | undefined> => {
  console.log(`\nWhitelisting contract on Kinto Wallet...`);
  const { contracts: kinto } = kintoConfig[chainId];

  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kinto.kintoWallet.abi,
    getKintoProvider(chainId)
  );

  if (await kintoWallet.appWhitelist(app)) {
    console.log(`- Contract is already whitelisted on Kinto Wallet`);
    return;
  } else {
    const txRequest = await kintoWallet.populateTransaction.whitelistApp(
      [app],
      [true],
      {
        gasLimit: 4_000_000,
      }
    );

    const tx = await handleOps({
      kintoWalletAddr,
      userOps: [txRequest],
      privateKeys,
      chainId,
    });
    console.log(`- Contract successfully whitelisted on Kinto Wallet`);
    return tx;
  }
};

const setFunderWhitelist = async (
  kintoWalletAddr: string,
  funders: string[],
  isWhitelisted: boolean[],
  provider: providers.Provider,
  privateKeys: string[],
  chainId: string
) => {
  const { contracts: kinto } = kintoConfig[chainId];
  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kinto.kintoWallet.abi,
    provider
  );
  console.log(`\nUpdating funders whitelist on Kinto Wallet...`);
  // for each funder, check which ones are not whitelistd (isFunderWhitelisted)
  // and add them to an array to be passed to setFunderWhitelist
  for (let i = 0; i < funders.length; i++) {
    if (
      (await kintoWallet.isFunderWhitelisted(funders[i])) === isWhitelisted[i]
    ) {
      console.log(
        `- Funder ${funders[i]} is already ${
          isWhitelisted[i] ? "whitelisted" : "blacklisted"
        }. Skipping...`
      );
      funders.splice(i, 1);
      isWhitelisted.splice(i, 1);
    } else {
      console.log(
        `- Funder ${funders[i]} will be ${
          isWhitelisted[i] ? "whitelisted" : "blacklisted"
        }`
      );
    }
  }

  // "function setFunderWhitelist(address[] calldata newWhitelist, bool[] calldata flags)",
  const txRequest = await kintoWallet.populateTransaction.setFunderWhitelist(
    funders,
    isWhitelisted
  );

  const tx = await handleOps({
    kintoWalletAddr,
    userOps: [txRequest],
    privateKeys,
    chainId,
  });
  console.log(`- Funders whitelist succesfully updated`);
  return tx;
};

// check if the contract inherits from Socket's custom 2-step Ownable contract
const isOwnable = async (abi: Array<any>): Promise<boolean> => {
  const hasOwner = abi.some((item) => item.name === "owner");
  const hasNominateOwner = abi.some((item) => item.name === "nominateOwner");
  // const hasTransferOwnership = abi.some((item) => item.name === "transferOwnership");
  return hasOwner && hasNominateOwner;
};

const needsNomination = async (abi: Array<any>): Promise<boolean> => {
  // possible owner parameter names
  const ownerParams = ["owner", "_owner", "owner_"];

  // find the constructor and check for any of the owner parameter names
  const hasOwnerParam = abi.some((item: any) => {
    return (
      item.type === "constructor" &&
      item.inputs.some((input: any) => ownerParams.includes(input.name))
    );
  });

  // if the constructor has an owner parameter, we don't need to call nominate since we pass the owner directly
  return !hasOwnerParam;
};

function isUserOpArray(array: any[]): boolean {
  return array.every(
    (item) => item.hasOwnProperty("sender") && item.hasOwnProperty("nonce")
  );
}

const createUserOp = async (
  params: CreateUserOpParam
): Promise<UserOperation> => {
  const {
    chainId = "7887",
    sender,
    paymaster,
    nonce,
    callData,
    privateKeys,
  } = params;
  const { callGasLimit, verificationGasLimit, preVerificationGas } =
    kintoConfig[chainId].userOpGasParams;
  const userOp = {
    sender,
    nonce,
    initCode: hexlify([]),
    callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas: parseUnits("1", "gwei"),
    maxPriorityFeePerGas: parseUnits("1", "gwei"),
    paymasterAndData: paymaster,
    signature: hexlify([]),
  };

  const signature = await signUserOp(sender, userOp, chainId, privateKeys);
  userOp.signature = signature;
  return userOp;
};

const hasErrors = (tx: TransactionReceipt): boolean => {
  const eventSignature =
    "UserOperationRevertReason(bytes32,address,uint256,bytes)";
  const eventTopic = id(eventSignature); // hash of the event
  const eventLog = tx.logs.find((log: any) => log.topics[0] === eventTopic);

  if (eventLog) {
    const types = [
      "uint256", // nonce
      "bytes", // revertReason
    ];

    // decode the data
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(types, eventLog.data);
      console.log("Revert Reason (hex):", ethers.utils.hexlify(decoded[1]));
    } catch (error) {
      console.error("Error decoding data:", error);
    }

    return true;
  }
  return false;
};

const checkGas = async (
  contractAddr: string,
  opsLength: number,
  isPaymaster: boolean,
  chainId: string
) => {
  const contract = new ethers.Contract(
    contractAddr,
    [],
    getKintoProvider(chainId)
  );
  const userOpGasParams = kintoConfig[chainId].userOpGasParams;
  const provider = contract.provider;
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas;
  if (!maxFeePerGas) {
    console.error("Error getting maxFeePerGas from provider");
    return;
  }
  const requiredPrefund = calculateRequiredPrefund(
    userOpGasParams,
    maxFeePerGas
  );
  const ethMaxCost = calculateEthMaxCost(requiredPrefund, maxFeePerGas).mul(
    opsLength
  );
  const contractBalance = await await provider.getBalance(contract.address);
  if (contractBalance.lt(ethMaxCost))
    throw new Error(
      `${
        isPaymaster ? "Paymaster" : "Kinto Wallet"
      } @ ${contractAddr} balance ${contractBalance} is less than the required ETH max cost ${ethMaxCost.toString()}`
    );
};

const calculateRequiredPrefund = (
  gasParams: UserOpGasParams,
  maxFeePerGas: BigNumber,
  multiplier = 1 // 2 if paymaster is used
): BigNumber => {
  const { callGasLimit, verificationGasLimit, preVerificationGas } = gasParams;
  const requiredGas =
    callGasLimit + verificationGasLimit * multiplier + preVerificationGas;
  const requiredPrefund = BigNumber.from(requiredGas).mul(maxFeePerGas);
  return requiredPrefund;
};

const calculateEthMaxCost = (
  requiredPrefund: BigNumber,
  maxFeePerGas: BigNumber
): BigNumber => requiredPrefund.add(COST_OF_POST.mul(maxFeePerGas));

const estimateGas = async (
  provider: providers.Provider,
  entryPoint: Contract,
  userOps: UserOperation[]
) => {
  const feeData = await provider.getFeeData();

  const gasLimit = await entryPoint.estimateGas.handleOps(
    userOps,
    await entryPoint.signer.getAddress()
  );
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  const maxFeePerGas = feeData.maxFeePerGas;
  const gasParams = {
    gasLimit: gasLimit || BigNumber.from("400000000"),
    maxPriorityFeePerGas: maxPriorityFeePerGas || parseUnits("1.1", "gwei"),
    maxFeePerGas: maxFeePerGas || parseUnits("1.1", "gwei"),
  };

  const txCost = gasParams.gasLimit.mul(gasParams.maxFeePerGas);
  console.log("- Estimated gas cost (ETH):", ethers.utils.formatEther(txCost));

  return gasParams;
};

// extract argument types from constructor
const extractArgTypes = async (abi: Array<any>): Promise<Array<string>> => {
  const constructorAbi = abi.find((element) => element.type === "constructor");
  let argTypes: string[] = [];
  if (constructorAbi && constructorAbi.inputs.length > 0) {
    argTypes = constructorAbi.inputs.map((input: any) => input.type);
  }
  return argTypes;
};

export {
  isKinto,
  setFunderWhitelist,
  handleOps,
  deployOnKinto,
  addAppContracts,
  whitelistApp,
  whitelistAppAndSetKey,
  estimateGas,
  extractArgTypes,
};
