import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildUserscript } from "./build-lib.mjs";

const expected = await buildUserscript({ write: false });
const current = await readFile(resolve(import.meta.dirname, "..", "pocitatko.user.js"), "utf8");

if (current !== expected) {
  console.error("pocitatko.user.js is stale; run npm run build");
  process.exitCode = 1;
} else {
  console.log("Generated userscript is current");
}
