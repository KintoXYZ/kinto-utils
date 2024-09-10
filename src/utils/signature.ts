import { Contract, ethers } from "ethers";
import {
  arrayify,
  defaultAbiCoder,
  keccak256,
  hashMessage,
  SigningKey,
  joinSignature,
} from "ethers/lib/utils";
import { LEDGER, TREZOR } from "./constants";
import TrezorSigner from "./trezorProvider";
import { LedgerSigner } from "./ledgerProvider";
import HIDTransport from "@ledgerhq/hw-transport-node-hid";
import { UserOperation } from "./types";
import { kintoConfig } from "./constants";

const packUserOpForSig = (userOp: UserOperation) => {
  return defaultAbiCoder.encode(
    [
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
    ],
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData),
    ]
  );
};

const getUserOpHash = async (userOp: UserOperation, chainId: string) => {
  const packedForSig = packUserOpForSig(userOp);
  const opHash = keccak256(packedForSig);
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [opHash, kintoConfig[chainId].contracts.entryPoint.address, chainId]
    )
  );
};

const signUserOp = async (
  kintoWalletAddr: string,
  userOp: UserOperation,
  chainId: string,
  privateKeys: string[]
): Promise<string> => {
  const provider = getKintoProvider(chainId);
  const kintoWallet = new ethers.Contract(
    kintoWalletAddr,
    kintoConfig[chainId].contracts.kintoWallet.abi,
    provider
  );

  // prepare hash to sign
  const hash = await getUserOpHash(userOp, chainId);
  const ethSignedHash = hashMessage(arrayify(hash));

  // check policy and required signers
  await checkPolicy(kintoWallet, privateKeys);

  let signature = "0x";
  for (const privateKey of privateKeys) {
    if (privateKey == TREZOR || privateKey == LEDGER) {
      // sign with hardware wallet if available
      const hwSignature = await signWithHw(hash, privateKey);
      console.log("- HW signature:", hwSignature);
      signature += hwSignature;
    } else {
      const signingKey = new SigningKey(privateKey);
      console.log(
        `\nSigning message: ${ethSignedHash} with signer: ${await new ethers.Wallet(
          privateKey
        ).getAddress()}...`
      );
      const sig = signingKey.signDigest(ethSignedHash);
      console.log("- EOA signature:", sig.compact);
      signature += joinSignature(sig).slice(2); // remove initial '0x'
    }
  }
  return signature;
};

const signWithHw = async (
  hash: string,
  hwType: string,
  chainId: string = "7887"
): Promise<string | undefined> => {
  const provider = getKintoProvider(chainId);
  const deviceName = hwType === TREZOR ? "Trezor" : "Ledger";
  try {
    console.log(`\nUsing ${deviceName} as second signer...`);
    if (hwType === LEDGER) {
      // @ts-ignore
      const ledger = new LedgerSigner(HIDTransport, provider);
      const signer = await ledger.getAddress();
      console.log(`\nSigning message: ${hash} with signer: ${signer}...`);
      console.log(
        "If you want to use another account index, set the ACCOUNT_INDEX env variable."
      );
      return await ledger.signMessage(hash);
    }

    if (hwType === TREZOR) {
      const trezorSigner = new TrezorSigner(provider);
      // const signer = await trezorSigner.getAddress();
      // console.log(`\nSigning message: ${hash} with signer: ${signer}...`);
      console.log(
        "If you want to use another account index, set the ACCOUNT_INDEX env variable."
      );
      return await trezorSigner.signMessage(hash);
    }
  } catch (e: any) {
    console.error(`\nError: Could not sign with ${deviceName}.`);
    throw new Error(e.message);
  }
  console.log("\nWARNING: No hardware wallet detected.");
  return;
};

const sign = async (privateKey: string, chainId: string): Promise<string> => {
  const config = kintoConfig[chainId];
  const wallet = new ethers.Wallet(privateKey, getKintoProvider(chainId));
  const kintoID = new ethers.Contract(
    config.contracts.kintoID.address as string,
    config.contracts.kintoID.abi,
    wallet
  );
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
    nonce: await kintoID.nonces(wallet.address),
    expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours expiry
  };

  const signature = await wallet._signTypedData(domain, types, value);
  console.log("Signature results:", {
    value,
    signature,
  });
  return signature;
};

const getKintoProvider = (chainId: string = "7887") => {
  return new ethers.providers.StaticJsonRpcProvider(
    kintoConfig[chainId].rpcUrl
  );
};

const checkPolicy = async (kintoWallet: Contract, privateKeys: string[]) => {
  const policy = await kintoWallet.signerPolicy();
  const ownersLength = await kintoWallet.getOwnersCount();
  const requiredSigners =
    policy == 3 ? ownersLength : policy == 1 ? 1 : policy == 4 ? 2 : ownersLength - 1;

  if (privateKeys.length < requiredSigners) {
    throw new Error(
      `Not enough private keys provided. Required ${requiredSigners}, got ${privateKeys.length}`
    );
  }
};

export { getKintoProvider, signUserOp, sign };
