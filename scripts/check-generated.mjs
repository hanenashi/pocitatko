import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAuthBridge, buildUserscript } from "./build-lib.mjs";

const expected = await buildUserscript({ write: false });
const current = await readFile(resolve(import.meta.dirname, "..", "pocitatko.user.js"), "utf8");

const expectedBridge = await buildAuthBridge({ write: false });
const currentBridge = await readFile(resolve(import.meta.dirname, "..", "firebase-hosting/auth/bridge.js"), "utf8");

if (current !== expected || currentBridge !== expectedBridge) {
  console.error("pocitatko.user.js is stale; run npm run build");
  process.exitCode = 1;
} else {
  console.log("Generated userscript and Firebase Auth bridge are current");
}
