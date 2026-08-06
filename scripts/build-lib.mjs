import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

export async function buildUserscript({ write = true } = {}) {
  const metadata = await readFile(resolve(root, "src/metadata.txt"), "utf8");
  const result = await build({
    entryPoints: [resolve(root, "src/main.js")],
    bundle: true,
    format: "iife",
    legalComments: "none",
    target: "es2020",
    write: false,
  });
  const output = `${metadata.trim()}\n\n${result.outputFiles[0].text}`;
  if (write) await writeFile(resolve(root, "pocitatko.user.js"), output);
  return output;
}
