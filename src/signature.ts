import { ethers } from "ethers";
import {
  arrayify,
  keccak256,
  hashMessage,
  SigningKey,
  joinSignature,
  defaultAbiCoder,
} from "ethers/lib/utils";
import KINTO_DATA from "./constants.json";
import { getDefaultProvider } from "ethers";

const packUserOpForSig = (userOp: any) => {
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

const getUserOpHash = async (userOp: object, entryPointAddress: string, chainId: number) => {
  const packedForSig = packUserOpForSig(userOp);
  const opHash = keccak256(packedForSig);
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [opHash, entryPointAddress, chainId]
    )
  );
};

const signUserOp = async (userOp: object, entryPointAddress: string, chainId: number, privateKeys: Array<string>) => {
  const hash = await getUserOpHash(userOp, entryPointAddress, chainId);
  const ethSignedHash = hashMessage(arrayify(hash));

  let signature = "0x";
  for (const privateKey of privateKeys) {
    const signingKey = new SigningKey(privateKey);
    const sig = signingKey.signDigest(ethSignedHash);
    signature += joinSignature(sig).slice(2); // remove initial '0x'
  }
  return signature;
};



const sign = async (privateKey: string, chainId: string): Promise<string> => {
  if (!chainId) throw new Error("Invalid chainId");

  // @ts-ignore
  const data = KINTO_DATA[chainId] as any;
  const wallet = new ethers.Wallet(
    privateKey,
    new ethers.providers.JsonRpcProvider(data.rpcUrl)
  );
  const kintoID = new ethers.Contract(
    data.contracts.kintoID.address,
    data.contracts.kintoID.abi,
    wallet
  );
  const domain = {
    name: "KintoID",
    version: "1",
    chainId,
    verifyingContract: data.contracts.kintoID.address,
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

export { signUserOp, sign };
