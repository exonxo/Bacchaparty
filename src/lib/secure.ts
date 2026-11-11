"use client";
/**
 * Room security, done on the devices with WebCrypto:
 *  - the host signs every room snapshot (ECDSA P-256), so phones can reject fakes;
 *  - each phone shares a secret key with the host (ECDH → AES-GCM), used to
 *    encrypt that player's private view and to authenticate their actions.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const cryptoAvailable = typeof crypto !== "undefined" && !!crypto.subtle;

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

export interface StoredKeyPair {
  publicKey: string; // raw, base64
  privateJwk: JsonWebKey;
}

async function generate(alg: typeof ECDSA | typeof ECDH, usages: KeyUsage[]): Promise<StoredKeyPair> {
  const pair = await crypto.subtle.generateKey(alg, true, usages);
  return {
    publicKey: b64(await crypto.subtle.exportKey("raw", pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
}

export const generateSigningKeys = () => generate(ECDSA, ["sign", "verify"]);
export const generateExchangeKeys = () => generate(ECDH, ["deriveKey"]);

export async function importSigner(pair: StoredKeyPair): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", pair.privateJwk, ECDSA, false, ["sign"]);
}

export async function sign(key: CryptoKey, text: string): Promise<string> {
  return b64(await crypto.subtle.sign(SIGN, key, enc.encode(text)));
}

export async function verify(publicKey: string, text: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", unb64(publicKey), ECDSA, false, ["verify"]);
    return await crypto.subtle.verify(SIGN, key, unb64(signature), enc.encode(text));
  } catch {
    return false;
  }
}

/** Shared AES-GCM key between my private ECDH key and their public key. */
export async function deriveShared(mine: StoredKeyPair, theirPublic: string): Promise<CryptoKey> {
  const priv = await crypto.subtle.importKey("jwk", mine.privateJwk, ECDH, false, ["deriveKey"]);
  const pub = await crypto.subtle.importKey("raw", unb64(theirPublic), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export interface Sealed {
  iv: string;
  ct: string;
}

export async function seal(key: CryptoKey, data: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Returns undefined when the message wasn't made with this key (forged or not for us). */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T | undefined> {
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return undefined;
  }
}

/** Runs async handlers one at a time, in arrival order. */
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return (job: () => Promise<void> | void) => {
    tail = tail.then(job).catch((e) => console.error("room message failed", e));
  };
}
