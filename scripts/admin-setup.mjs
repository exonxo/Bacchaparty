#!/usr/bin/env node
// Admin panel setup helper. Runs on your own computer; it makes no network calls.
//
//   node scripts/admin-setup.mjs path               random secret URL segment for ADMIN_PATH
//   node scripts/admin-setup.mjs session            random value for ADMIN_SESSION_SECRET
//   node scripts/admin-setup.mjs password "<pw>"    scrypt hash for ADMIN_PASSWORD_HASH
//   node scripts/admin-setup.mjs totp               authenticator secret for ADMIN_TOTP_SECRET
//                                                   (prints a link to scan in Google Authenticator)
//
// Put the printed values in Vercel's environment variables (Production). Never commit them.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const [cmd, arg] = process.argv.slice(2);

function base32(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

switch (cmd) {
  case "path":
    console.log(randomBytes(24).toString("base64url"));
    break;
  case "session":
    console.log(randomBytes(48).toString("base64url"));
    break;
  case "password": {
    if (!arg || arg.length < 12) {
      console.error("Use a password of at least 12 characters.");
      process.exit(1);
    }
    const N = 16384, R = 8, P = 1;
    const salt = randomBytes(16);
    const key = await scrypt(arg, salt, 64, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
    console.log(`scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`);
    break;
  }
  case "totp": {
    const secret = base32(randomBytes(20));
    console.log(`ADMIN_TOTP_SECRET=${secret}`);
    console.log(
      `Add to your authenticator app (manual entry, time-based, 6 digits):\n` +
        `otpauth://totp/BAWAAL%20Admin?secret=${secret}&issuer=BAWAAL`,
    );
    break;
  }
  default:
    console.log("Usage: node scripts/admin-setup.mjs path | session | password \"<pw>\" | totp");
    process.exit(cmd ? 1 : 0);
}
