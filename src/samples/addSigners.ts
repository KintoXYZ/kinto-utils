import { BigNumber, ethers } from "ethers";
import "../kinto";
import { handleOps } from "../kinto";
import { LEDGER, TREZOR } from "../utils/constants";
import { getKintoProvider } from "../utils/signature";
import { HandleOpsParams } from "../utils/types";

// sample on how to add a signer to KintoWallet
(async () => {
  const NEW_SIGNER = "";
  if (!NEW_SIGNER || NEW_SIGNER === "") throw new Error("NEW_SIGNER missing");
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");
  if (!process.env.KINTO_WALLET) throw new Error("KINTO_WALLET missing");

  const privateKeys = [process.env.PRIVATE_KEY, TREZOR];
  const kintoWalletAddr = process.env.KINTO_WALLET;

  // get KintoWallet instance
  const abi = [
    "function resetSigners(address[] calldata newSigners, uint8 policy) external",
    "function owners(uint256) view returns (address)",
    "function getOwnersCount() view returns (uint256)",
  ];
  const wallet = new ethers.Contract(
    kintoWalletAddr,
    abi,
    getKintoProvider("7887")
  );

  // get current owners
  const ownersCount = await wallet.getOwnersCount();
  console.log(`- Owners count: ${ownersCount}`);

  let owners = [];
  for (let i = 0; i < ownersCount; i++) {
    const owner = await wallet.owners(i);
    owners.push(owner);
    console.log(`- Owner[${i}]: ${owner}`);
  }

  // add a new signer
  owners.push(NEW_SIGNER);
  const tx = await wallet.populateTransaction.resetSigners(owners, 2);

  const params: HandleOpsParams = {
    kintoWalletAddr,
    userOps: [tx],
    privateKeys,
    // gasParams: { gasLimit: BigNumber.from("4000000") }
  };
  console.log(`- Adding ${NEW_SIGNER} as new signer on KintoWallet...`);
  await handleOps(params);
  console.log(`- Owners count: ${await wallet.getOwnersCount()}`);
})();
