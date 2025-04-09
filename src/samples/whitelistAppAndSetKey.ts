import { ethers } from "ethers";
import "../kinto";
import { whitelistAppAndSetKey } from "../kinto";
import { getKintoProvider } from "../utils/signature";

// sample on how to whitelist a contract and set a key on a Kinto Wallet
(async () => {
  if (!process.env.SIGNER0) throw new Error("SIGNER0 missing");
  if (!process.env.SIGNER1) throw new Error("SIGNER1 missing");
  if (!process.env.WALLET_ADDRESS) throw new Error("WALLET_ADDRESS missing");

  // Private keys and addresses
  const privateKeys = [process.env.SIGNER0, process.env.SIGNER1];
  const kintoWalletAddr = process.env.WALLET_ADDRESS;

  // App contract to whitelist
  const appContractAddr = "0xD157904639E89df05e89e0DabeEC99aE3d74F9AA";

  // Chain ID (default to Kinto mainnet)
  const chainId = "7887";

  console.log(`\nWhitelisting app and setting key...`);
  console.log(`- Kinto Wallet address: ${kintoWalletAddr}`);
  console.log(`- App contract address: ${appContractAddr}`);

  // Call the whitelistAppAndSetKey function
  await whitelistAppAndSetKey(
    kintoWalletAddr, // Kinto wallet address
    appContractAddr, // App contract address
    privateKeys, // Private keys for signing
    chainId // Chain ID
  );

  console.log(`\nCompleted successfully`);
})();
