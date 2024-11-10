import { KintoConfig } from "./types";

export const kintoConfig: KintoConfig = {
  "7887": {
    rpcUrl: "https://kinto-mainnet.calderachain.xyz/http",
    contracts: {
      socketDL: {
        address: "0x3e9727470C66B1e77034590926CDe0242B5A3dCc",
        abi: [],
      },
      appRegistry: {
        address: "0x5A2b641b84b0230C8e75F55d5afd27f4Dbd59d5b",
        abi: [
          "function addAppContracts(address app, address[] calldata newContracts)",
          "function getAppMetadata(address target) view returns (tuple(uint256 tokenId, bool dsaEnabled, uint256 rateLimitPeriod, uint256 rateLimitNumber, uint256 gasLimitPeriod, uint256 gasLimitCost, string name, address[] devEOAs, address[] appContracts) memory)",
        ],
      },
      kintoID: {
        address: "0xf369f78E3A0492CC4e96a90dae0728A38498e9c7",
        abi: [
          "function nonces(address) view returns (uint256)",
          "function domainSeparator() view returns (bytes32)",
        ],
      },
      kintoWallet: {
        address: "",
        abi: [
          "function appSigner(address) view returns (address)",
          "function getNonce() view returns (uint256)",
          "function whitelistApp(address[] calldata apps, bool[] calldata flags)",
          "function execute(address dest, uint256 value, bytes calldata func)",
          "function appWhitelist(address) view returns (bool)",
          "function whitelistAppAndSetKey(address app, address signer)",
          "function setAppKey(address app, address signer)",
          "function setFunderWhitelist(address[] calldata newWhitelist, bool[] calldata flags)",
          "function isFunderWhitelisted(address) view returns (bool)",
          "function owners(uint256) view returns (address)",
          "function signerPolicy() view returns (uint256)",
          "function getOwnersCount() view returns (uint256)",
        ],
      },
      factory: {
        address: "0x8a4720488CA32f1223ccFE5A087e250fE3BC5D75",
        abi: [
          "function deployContract(address contractOwner, uint256 amount, bytes memory bytecode, bytes32 salt) returns (address)",
        ],
      },
      entryPoint: {
        address: "0x2843C269D2a64eCfA63548E8B3Fc0FD23B7F70cb",
        abi: [
          "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)",
        ],
      },
      paymaster: {
        address: "0x1842a4EFf3eFd24c50B63c3CF89cECEe245Fc2bd",
        abi: ["function balances(address) view returns (uint256)"],
      },
      deployer: {
        address: "0xcab6dF19e2C77493547baB23ad85597f8303CE92",
        abi: [
          "function deploy(address owner, bytes calldata bytecode, bytes32 salt) public returns (address)",
        ],
      },
    },
    userOpGasParams: {
      callGasLimit: 4000000,
      verificationGasLimit: 210000,
      preVerificationGas: 21000,
    },
  },
  "412346": {
    rpcUrl: "https://kinto-upgrade-dev-2.rpc.caldera.xyz/http",
    contracts: {
      socketDL: {
        address: "",
        abi: [],
      },
      appRegistry: {
        address: "",
        abi: [
          "function addAppContracts(address app, address[] calldata newContracts)",
        ],
      },
      kintoID: {
        address: "0xCa41d9C3f13a8096356E6fddf0a29C51A938c410",
        abi: [
          "function nonces(address) view returns (uint256)",
          "function domainSeparator() view returns (bytes32)",
        ],
      },
      kintoWallet: {
        address: "",
        abi: [
          "function getNonce() view returns (uint256)",
          "function whitelistApp(address[] calldata apps, bool[] calldata flags)",
          "function execute(address dest, uint256 value, bytes calldata func)",
          "function appWhitelist(address) view returns (bool)",
          "function setFunderWhitelist(address[] calldata newWhitelist, bool[] calldata flags)",
          "function isFunderWhitelisted(address) view returns (bool)",
        ],
      },
      factory: {
        address: "0xB8818F4c0CE119AC274f217e9C11506DCf1bBb70",
        abi: [
          "function deployContract(address contractOwner, uint256 amount, bytes memory bytecode, bytes32 salt) returns (address)",
        ],
      },
      entryPoint: {
        address: "0x302b00A0b9C865F89099d27F7538CEe33E9A4f92",
        abi: [
          "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)",
        ],
      },
      paymaster: {
        address: "0x8dc62b6FAF2929a58a1fca99aCF394ddf0CfAD16",
        abi: ["function balances(address) view returns (uint256)"],
      },
      deployer: {
        address: "0x3a4ee5742b854688a35DE9F853Cb0D55e7D80c96",
        abi: [
          "function deploy(address owner, bytes calldata bytecode, bytes32 salt) public returns (address)",
        ],
      },
    },
    userOpGasParams: {
      callGasLimit: 4000000,
      verificationGasLimit: 210000,
      preVerificationGas: 21000,
    },
  },
};

export const TREZOR = "0";
export const LEDGER = "1";
