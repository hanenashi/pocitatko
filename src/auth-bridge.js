const GOOGLE_CLIENT_ID = "650129813114-6c8n02m8c1044vsd6cl2unmd1bjaqv44.apps.googleusercontent.com";

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

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google přihlášení se nepodařilo načíst."));
    document.head.append(script);
  });
}

async function run() {
  const params = new URLSearchParams(location.search);
  const returnUrl = allowedReturnUrl(params.get("returnUrl"));
  const nonce = params.get("nonce");
  const action = params.get("action") === "link" ? "link" : "signIn";
  if (!nonce) throw new Error("Chybí bezpečný návrat do Pociťátka.");

  await loadGoogleIdentity();
  show(action === "link"
    ? "Vyberte Google účet, ke kterému chcete trvale připojit toto UID."
    : "Vyberte Google účet pro přihlášení do Pociťátka.");

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce,
    auto_select: false,
    callback(response) {
      try {
        if (!response?.credential) throw new Error("Google neposlal přihlašovací token.");
        returnUrl.hash = new URLSearchParams({
          "pocitatko-auth": encodePayload({ nonce, idToken: response.credential }),
        }).toString();
        show("Hotovo, vracím se do Pociťátka…");
        location.replace(returnUrl.href);
      } catch (error) {
        show(error?.message || "Přihlášení se nezdařilo.", true);
      }
    },
  });
  window.google.accounts.id.renderButton(document.getElementById("google-button"), {
    type: "standard",
    theme: "filled_black",
    size: "large",
    text: action === "link" ? "continue_with" : "signin_with",
    shape: "pill",
    locale: "cs",
  });
}

run().catch((error) => show(error?.message || "Přihlášení se nezdařilo.", true));
