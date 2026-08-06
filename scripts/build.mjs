import { buildAuthBridge, buildUserscript } from "./build-lib.mjs";

await buildUserscript();
await buildAuthBridge();
console.log("Built pocitatko.user.js and Firebase Auth bridge");
