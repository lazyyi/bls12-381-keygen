"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveChild = exports.deriveMaster = exports.hkdfModR = void 0;
const sha256 = __importStar(require("fast-sha256"));
// Verify this with EIP-2333: https://eips.ethereum.org/EIPS/eip-2333
// bls12-381 r
const blsR = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
function numberToBytes(num) {
    let hex = num.toString(16);
    if (hex.length & 1)
        hex = `0${hex}`;
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < array.length; i++) {
        const j = i * 2;
        array[i] = Number.parseInt(hex.slice(j, j + 2), 16);
    }
    return array;
}
// Octet Stream to Integer
function os2ip(bytes) {
    let result = 0n;
    for (let i = 0; i < bytes.length; i++) {
        result <<= 8n;
        result += BigInt(bytes[i]);
    }
    return result;
}
// Integer to Octet Stream
function i2osp(value, length) {
    if (value < 0 || value >= 1n << BigInt(8 * length)) {
        throw new Error(`bad I2OSP call: value=${value} length=${length}`);
    }
    const res = Array.from({ length }).fill(0);
    for (let i = length - 1; i >= 0; i--) {
        res[i] = value & 0xff;
        value >>>= 8;
    }
    return new Uint8Array(res);
}
function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
}
function concatBytes(...arrays) {
    if (arrays.length === 1)
        return arrays[0];
    const length = arrays.reduce((a, arr) => a + arr.length, 0);
    const result = new Uint8Array(length);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const arr = arrays[i];
        result.set(arr, pad);
        pad += arr.length;
    }
    return result;
}
function ikmToLamportSK(ikm, salt) {
    const okm = sha256.hkdf(ikm, salt, undefined, 32 * 255);
    return Array.from({ length: 255 }, (_, i) => okm.slice(i * 32, (i + 1) * 32));
}
function parentSKToLamportPK(parentSK, index) {
    if (!(parentSK instanceof Uint8Array))
        throw new TypeError('Expected Uint8Array');
    if (!Number.isSafeInteger(index) || index < 0 || index >= 2 ** 32) {
        throw new TypeError('Expected positive number');
    }
    const salt = i2osp(index, 4);
    const ikm = parentSK;
    const lamport0 = ikmToLamportSK(ikm, salt);
    const notIkm = ikm.map((byte) => ~byte);
    const lamport1 = ikmToLamportSK(notIkm, salt);
    const lamportPK = lamport0.concat(lamport1).map((part) => sha256.hash(part));
    return sha256.hash(concatBytes(...lamportPK));
}
function hkdfModR(ikm, keyInfo = new Uint8Array()) {
    let salt = utf8ToBytes("BLS-SIG-KEYGEN-SALT-");
    let SK = 0n;
    const input = concatBytes(ikm, Uint8Array.from([0x00]));
    const label = concatBytes(keyInfo, Uint8Array.from([0x00, 0x30]));
    while (SK === 0n) {
        salt = sha256.hash(salt);
        const okm = sha256.hkdf(input, salt, label, 48);
        SK = os2ip(okm) % blsR;
    }
    return numberToBytes(SK);
}
exports.hkdfModR = hkdfModR;
function deriveMaster(seed) {
    return hkdfModR(seed);
}
exports.deriveMaster = deriveMaster;
function deriveChild(parentKey, index) {
    return hkdfModR(parentSKToLamportPK(parentKey, index));
}
exports.deriveChild = deriveChild;