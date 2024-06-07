"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _LedgerSigner_transport, _LedgerSigner_path;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerSigner = void 0;
const ethers_v6_1 = require("ethers-v6");
//import { ledgerService } from "@ledgerhq/hw-app-eth"
const hw_app_eth_1 = __importDefault(require("@ledgerhq/hw-app-eth"));
const Eth = "default" in hw_app_eth_1.default ? hw_app_eth_1.default.default : hw_app_eth_1.default;
/**
 *  A **LedgerSigner** provides access to a Ledger Hardware Wallet
 *  as an Ethers Signer.
 */
class LedgerSigner extends ethers_v6_1.AbstractSigner {
    /**
     *  Create a new **LedgerSigner** connected to the device over the
     *  %%transport%% and optionally connected to the blockchain via
     *  %%provider%%. The %%path%% follows the same logic as
     *  [[LedgerSigner_getPath]], defaulting to the default HD path of
     *  ``m/44'/60'/0'/0/0``.
     */
    constructor(transport, provider, path) {
        (0, ethers_v6_1.assertArgument)(transport &&
            (typeof transport == "object" || typeof transport == "function"), "invalid transport", "transport", transport);
        super(provider);
        // A Promise that resolves to a created transport
        _LedgerSigner_transport.set(this, void 0);
        // The HD path
        _LedgerSigner_path.set(this, void 0);
        // Dereference package imports that use the default export
        if ("default" in transport) {
            transport = transport.default;
        }
        // If the transport has not been created, create it
        if (typeof transport.create == "function") {
            transport = transport.create();
        }
        __classPrivateFieldSet(this, _LedgerSigner_transport, Promise.resolve(transport), "f");
        __classPrivateFieldSet(this, _LedgerSigner_path, LedgerSigner.getPath(path), "f");
    }
    /**
     *  The HD path for this account
     */
    get path() {
        return __classPrivateFieldGet(this, _LedgerSigner_path, "f");
    }
    connect(provider) {
        return new LedgerSigner(__classPrivateFieldGet(this, _LedgerSigner_transport, "f"), provider);
    }
    close() {
        __classPrivateFieldGet(this, _LedgerSigner_transport, "f").then((transport) => {
            console.log(transport);
            if (typeof transport.close === "function") {
                transport.setDisconnected();
            }
        });
    }
    /**
     *  Returns a new LedgerSigner connected via the same transport
     *  and provider, but using the account at the HD %%path%%.
     */
    getSigner(path) {
        return new LedgerSigner(__classPrivateFieldGet(this, _LedgerSigner_transport, "f"), this.provider, path);
    }
    getAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transport = yield __classPrivateFieldGet(this, _LedgerSigner_transport, "f");
                const obj = yield new Eth(transport).getAddress(__classPrivateFieldGet(this, _LedgerSigner_path, "f"));
                return (0, ethers_v6_1.getAddress)(obj.address);
            }
            catch (error) {
                if (error.statusCode === 27404) {
                    const e = new Error("device is not running Ethereum App");
                    e.ledgerError = error;
                    throw e;
                }
                throw error;
            }
        });
    }
    signTransaction(_tx) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Replace any Addressable or ENS name with an address
                _tx = (0, ethers_v6_1.copyRequest)(_tx);
                const { to, from } = yield (0, ethers_v6_1.resolveProperties)({
                    to: _tx.to ? (0, ethers_v6_1.resolveAddress)(_tx.to, this.provider) : undefined,
                    from: _tx.from ? (0, ethers_v6_1.resolveAddress)(_tx.from, this.provider) : undefined,
                });
                if (to != null) {
                    _tx.to = to;
                }
                if (from != null) {
                    _tx.from = from;
                }
                const tx = ethers_v6_1.Transaction.from(_tx);
                const rawTx = tx.unsignedSerialized.substring(2);
                //const resolution = await ledgerService.resolveTransaction(rawTx);
                const resolution = {
                    domains: [],
                    plugin: [],
                    externalPlugin: [],
                    nfts: [],
                    erc20Tokens: [],
                };
                // Ask the Ledger to sign for us
                const transport = yield __classPrivateFieldGet(this, _LedgerSigner_transport, "f");
                const obj = yield new Eth(transport).signTransaction(__classPrivateFieldGet(this, _LedgerSigner_path, "f"), rawTx, resolution);
                // Normalize the signature for Ethers
                obj.v = "0x" + obj.v;
                obj.r = "0x" + obj.r;
                obj.s = "0x" + obj.s;
                // Update the transaction with the signature
                tx.signature = obj;
                return tx.serialized;
            }
            catch (error) {
                throw error;
            }
        });
    }
    signMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            // if (typeof(message) === "string") { message = toUtf8Bytes(message); }
            try {
                const transport = yield __classPrivateFieldGet(this, _LedgerSigner_transport, "f");
                const obj = yield new Eth(transport).signPersonalMessage(__classPrivateFieldGet(this, _LedgerSigner_path, "f"), (0, ethers_v6_1.hexlify)(message).substring(2));
                // Normalize the signature for Ethers
                obj.r = "0x" + obj.r;
                obj.s = "0x" + obj.s;
                // Serialize the signature
                const signature = ethers_v6_1.Signature.from(obj).serialized;
                console.log("Ledger closing...");
                const __eth = yield new Eth(transport);
                yield __eth.transport.device.close();
                console.log("Ledger closed...");
                return signature.substring(2); // remove 0x
            }
            catch (error) {
                throw error;
            }
        });
    }
    signTypedData(domain, types, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Populate any ENS names
            const populated = yield ethers_v6_1.TypedDataEncoder.resolveNames(domain, types, value, (name) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, ethers_v6_1.resolveAddress)(name, this.provider);
            }));
            try {
                const transport = yield __classPrivateFieldGet(this, _LedgerSigner_transport, "f");
                const eth = new Eth(transport);
                const payload = ethers_v6_1.TypedDataEncoder.getPayload(populated.domain, types, populated.value);
                let obj;
                try {
                    // Try signing the EIP-712 message
                    obj = yield eth.signEIP712Message(__classPrivateFieldGet(this, _LedgerSigner_path, "f"), payload);
                }
                catch (error) {
                    if (!error || error.statusCode !== 27904) {
                        throw error;
                    }
                    // Older device; fallback onto signing raw hashes
                    const domainHash = ethers_v6_1.TypedDataEncoder.hashDomain(domain);
                    const valueHash = ethers_v6_1.TypedDataEncoder.from(types).hash(value);
                    try {
                        obj = yield eth.signEIP712HashedMessage(__classPrivateFieldGet(this, _LedgerSigner_path, "f"), domainHash.substring(2), valueHash.substring(2));
                    }
                    catch (error) {
                        throw error;
                    }
                }
                // Normalize the signature for Ethers
                obj.r = "0x" + obj.r;
                obj.s = "0x" + obj.s;
                // Serialize the signature
                return ethers_v6_1.Signature.from(obj).serialized;
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     *  Returns the HD %%path%%. If unspecified, returns the default
     *  path (i.e. ``m/44'/60'/0'/0/0``), if a ``number``, the path
     *  is for that account using the BIP-44 standard, otherwise %%path%%
     *  is returned directly.
     */
    static getPath(path) {
        if (path == null) {
            path = 0;
        }
        if (typeof path === "number") {
            return (0, ethers_v6_1.getAccountPath)(path);
        }
        return path;
    }
}
exports.LedgerSigner = LedgerSigner;
_LedgerSigner_transport = new WeakMap(), _LedgerSigner_path = new WeakMap();
