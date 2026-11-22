import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";

function readPassword(label) {
  const password = spawnSync("sh", ["-c", `printf '${label}' >&2; stty -echo < /dev/tty; IFS= read -r value < /dev/tty; stty echo < /dev/tty; printf '\\n' >&2; printf '%s' "$value"`], {
    encoding:"utf8"
  }).stdout;
  if (!password) throw new Error("Password cannot be empty");
  return password;
}

const source = "data/trip.json";
const outputDir = "public/data";
const output = `${outputDir}/trip.enc`;

const password = readPassword("Enter the shared website password: ");
const confirmation = readPassword("Confirm the shared website password: ");
if (password !== confirmation) throw new Error("Passwords do not match");
await mkdir(outputDir, { recursive:true });
const plaintext = await readFile(source);
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const baseKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveKey"]
);
const key = await webcrypto.subtle.deriveKey(
  { name:"PBKDF2", salt, iterations:250000, hash:"SHA-256" },
  baseKey,
  { name:"AES-GCM", length:256 },
  false,
  ["encrypt"]
);
const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name:"AES-GCM", iv }, key, plaintext));
const encrypted = new Uint8Array(salt.length + iv.length + ciphertext.length);
encrypted.set(salt, 0);
encrypted.set(iv, salt.length);
encrypted.set(ciphertext, salt.length + iv.length);

await writeFile(output, encrypted);

console.log("Encrypted trip data. Password was not written to disk.");
