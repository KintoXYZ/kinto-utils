import { ethers } from "ethers";
import "../kinto";
import { handleOps } from "../kinto";
import { LEDGER, TREZOR } from "../utils/constants";
import { getKintoProvider } from "../utils/signature";
import { HandleOpsParams } from "../utils/types";

// sample on how to deploy a Counter contract
(async () => {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");

  // Counter contract bytecode
  const privateKeys = [process.env.PRIVATE_KEY, LEDGER];
  const counterAddr = "0xCB514a2Eb87bfB4F651420551362793771661F43";
  const abi = [
    "function count() view returns (uint256)",
    "function increment()",
  ];
  const counter = new ethers.Contract(
    counterAddr,
    abi,
    getKintoProvider("7887")
  );
  const tx = await counter.populateTransaction.increment();
  const params: HandleOpsParams = {
    kintoWalletAddr: "0x7403542bF2aF061eBF0DC16cAfA3068b90Fc1e75",
    userOps: [tx],
    privateKeys,
    // gasParams: { gasLimit: ethers.BigNumber.from("4000000") },
  };
  console.log(`- Count is: ${await counter.count()}`);
  console.log(`- Incrementing count...`);
  await handleOps(params);
  console.log(`- Count is: ${await counter.count()}`);
})();
