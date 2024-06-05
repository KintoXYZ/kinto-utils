import "../kinto";
import { deployOnKinto } from "../kinto";
import { TREZOR } from "../utils/constants";
import { DeployOnKintoParams } from "../utils/types";

// sample on how to deploy a Counter contract
(async () => {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");

  // Counter contract bytecode
  const privateKeys = [process.env.PRIVATE_KEY, TREZOR];
  const bytecode =
    "0x608060405234801561001057600080fd5b506000805560cc806100236000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c806306661abd146037578063d09de08a146051575b600080fd5b603f60005481565b60405190815260200160405180910390f35b60576059565b005b6001600080828254606991906070565b9091555050565b80820180821115609057634e487b7160e01b600052601160045260246000fd5b9291505056fea26469706673582212203c0d35ab9d00a191bf5be70ee547884303f1863f8dc445e5d371003a6549c5fe64736f6c63430008180033";
  const params: DeployOnKintoParams = {
    kintoWalletAddr: "0x7403542bF2aF061eBF0DC16cAfA3068b90Fc1e75",
    bytecode,
    privateKeys,
  };

  const contract = await deployOnKinto(params);
  console.log(`- Contract deployed @ ${contract}`);
})();
