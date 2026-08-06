import { initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
} from "firebase/auth";
import { firebaseConfig } from "./core/firebase-config.js";

const RETURN_URL_KEY = "pocitatko.authBridge.returnUrl";
const NONCE_KEY = "pocitatko.authBridge.nonce";

function show(message, error = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.dataset.error = error ? "true" : "false";
}

function allowedReturnUrl(value) {
  const url = new URL(value);
  if (url.origin !== "https://www.okoun.cz") throw new Error("Nepovolená návratová doména.");
  if (url.pathname !== "/boards/vymysli_vtipny_textik") throw new Error("Nepovolený návratový klub.");
  url.hash = "";
  return url;
}

function encodePayload(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function run() {
  const params = new URLSearchParams(location.search);
  const incomingReturnUrl = params.get("returnUrl");
  const incomingNonce = params.get("nonce");
  if (incomingReturnUrl && incomingNonce) {
    sessionStorage.setItem(RETURN_URL_KEY, allowedReturnUrl(incomingReturnUrl).href);
    sessionStorage.setItem(NONCE_KEY, incomingNonce);
  }

  const savedReturnUrl = sessionStorage.getItem(RETURN_URL_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY);
  if (!savedReturnUrl || !nonce) throw new Error("Chybí bezpečný návrat do Pociťátka.");

  const auth = getAuth(initializeApp(firebaseConfig));
  show("Dokončuji přihlášení…");
  const result = await getRedirectResult(auth);
  if (!result) {
    show("Otevírám přihlášení Google…");
    await signInWithRedirect(auth, new GoogleAuthProvider());
    return;
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.idToken) throw new Error("Google neposlal přihlašovací token.");
  sessionStorage.removeItem(RETURN_URL_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  const returnUrl = allowedReturnUrl(savedReturnUrl);
  returnUrl.hash = new URLSearchParams({
    "pocitatko-auth": encodePayload({ nonce, idToken: credential.idToken }),
  }).toString();
  show("Hotovo, vracím se do Pociťátka…");
  location.replace(returnUrl.href);
}

run().catch((error) => show(error?.message || "Přihlášení se nezdařilo.", true));
