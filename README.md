# Kinto Utils

## Install

```
git clone https://github.com/KintoXYZ/kinto-utils.git

cd kinto-utils

yarn install
```

## Running signer

`npx ts-node ./src/sign.ts <privateKey> <chainId>`

## Deploy Counter contract

`npx ts-node src/samples/deployContract.ts`

## Increment counter

`npx ts-node src/samples/callContract.ts`

## Whitelist App and Set Key

This script allows you to whitelist a contract and set a signer key on a Kinto Wallet.

```bash
# Set required environment variables
export SIGNER0=your_first_private_key
export SIGNER1=your_second_private_key
export WALLET_ADDRESS=your_kinto_wallet_address

# Run the script
npx ts-node src/samples/whitelistAppAndSetKey.ts
```

You can also run it as a one-liner:

```bash
SIGNER0=your_first_private_key SIGNER1=your_second_private_key WALLET_ADDRESS=your_kinto_wallet_address npx ts-node src/samples/whitelistAppAndSetKey.ts
```

By default, it uses the Kinto mainnet (chainId 7887). You can modify the script to use a different chain if needed.
