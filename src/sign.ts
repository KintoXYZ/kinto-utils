import { sign } from "./signature";

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("Usage: npx ts-node sign.ts <privateKey> <chainId>");
    process.exit(1);
  }
  const privateKey = args[0];
  const chainId = args[1];
  await sign(privateKey, chainId);
};

main();
