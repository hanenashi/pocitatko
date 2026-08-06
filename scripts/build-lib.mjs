import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function firebaseDefines() {
  const source = await readFile(resolve(root, ".env"), "utf8");
  const values = Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map((match) => {
        const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
        return [match[1], value];
      }),
  );
  const required = [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_APP_ID",
  ];
  const missing = required.filter((key) => !values[key]);
  if (missing.length) throw new Error(`Missing Firebase variables: ${missing.join(", ")}`);
  return Object.fromEntries(
    required.map((key) => [`__POCITATKO_${key}__`, JSON.stringify(values[key])]),
  );
}

async function bundledOutput(entryPoint) {
  const result = await build({
    entryPoints: [resolve(root, entryPoint)],
    bundle: true,
    format: "iife",
    legalComments: "none",
    target: "es2020",
    define: await firebaseDefines(),
    write: false,
  });
  return result.outputFiles[0].text;
}

export async function buildUserscript({ write = true } = {}) {
  const metadata = await readFile(resolve(root, "src/metadata.txt"), "utf8");
  const output = `${metadata.trim()}\n\n${await bundledOutput("src/main.js")}`;
  if (write) await writeFile(resolve(root, "pocitatko.user.js"), output);
  return output;
}

export async function buildAuthBridge({ write = true } = {}) {
  const output = await bundledOutput("src/auth-bridge.js");
  if (write) {
    const directory = resolve(root, "firebase-hosting/auth");
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "bridge.js"), output);
  }
  return output;
}
