import { BigNumber, PopulatedTransaction } from "ethers";

export type UserOperation = {
  sender: string;
  nonce: BigNumber;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  paymasterAndData: string;
  signature: string;
};

export type GasParams = {
  gasLimit?: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
};

export type GasParamsType1 = {
  gasLimit?: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
};

export type UserOpGasParams = {
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
};

export type HandleOpsParams = {
  kintoWalletAddr: string;
  userOps: PopulatedTransaction[] | UserOperation[];
  privateKeys: string[];
  chainId?: string;
  values?: BigNumber[];
  gasParams?: GasParams;
  paymasterAddr?: string;
};

export type DeployWithKintoFactoryParam = {
  kintoWalletAddr: string;
  bytecode: string;
  argTypes?: Array<string>;
  args?: Array<any>;
  privateKey: string;
  chainId?: string;
};

export type CreateUserOpParam = {
  chainId?: string;
  sender: string;
  paymaster: string;
  nonce: BigNumber;
  callData: string;
  privateKeys: string[];
};

export type DeployWithDeployerParam = {
  kintoWalletAddr: string;
  bytecode: string;
  abi: Array<any>;
  argTypes?: Array<string>;
  args?: Array<any>;
  privateKeys: string[];
  chainId?: string;
  paymasterAddr?: string;
};

export type DeployOnKintoParams = {
  chainId?: string;
  kintoWalletAddr: string;
  bytecode: string;
  privateKeys: string[];
  abi?: Array<any>;
  argTypes?: Array<string>;
  args?: Array<string>;
};

export interface Contract {
  address: string;
  abi: string[];
}

export interface KintoDataContracts {
  kintoID: Contract;
  kintoWallet: Contract;
  factory: Contract;
  socketDL: Contract;
  appRegistry: Contract;
  entryPoint: Contract;
  paymaster: Contract;
  deployer: Contract;
}

export interface KintoData {
  rpcUrl: string;
  contracts: KintoDataContracts;
  userOpGasParams: UserOpGasParams;
}

export interface KintoConfig {
  [networkId: string]: KintoData;
}
