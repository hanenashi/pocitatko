import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function bundledOutput(entryPoint) {
  const result = await build({
    entryPoints: [resolve(root, entryPoint)],
    bundle: true,
    format: "iife",
    legalComments: "none",
    target: "es2020",
    write: false,
  });
  // Keep esbuild's generated source comments stable across npm and pnpm installs.
  return result.outputFiles[0].text.replace(
    /node_modules\/\.pnpm\/[^/\n]+\/node_modules\//g,
    "node_modules/",
  );
}

export async function buildUserscript({ write = true } = {}) {
  const metadata = await readFile(resolve(root, "src/metadata.txt"), "utf8");
  const output = `${metadata.trim()}\n\n${await bundledOutput("src/main.js")}`;
  if (write) await writeFile(resolve(root, "pocitatko.user.js"), output);
  return output;
}
