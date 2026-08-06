(() => {
  // src/auth-bridge.js
  var GOOGLE_CLIENT_ID = "650129813114-6c8n02m8c1044vsd6cl2unmd1bjaqv44.apps.googleusercontent.com";
  function show(message, error = false) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.dataset.error = error ? "true" : "false";
  }
  function allowedReturnUrl(value) {
    const url = new URL(value);
    if (url.origin !== "https://www.okoun.cz") throw new Error("Nepovolen\xE1 n\xE1vratov\xE1 dom\xE9na.");
    if (url.pathname !== "/boards/vymysli_vtipny_textik") throw new Error("Nepovolen\xFD n\xE1vratov\xFD klub.");
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
      script.onerror = () => reject(new Error("Google p\u0159ihl\xE1\u0161en\xED se nepoda\u0159ilo na\u010D\xEDst."));
      document.head.append(script);
    });
  }
  async function run() {
    const params = new URLSearchParams(location.search);
    const returnUrl = allowedReturnUrl(params.get("returnUrl"));
    const nonce = params.get("nonce");
    const action = params.get("action") === "link" ? "link" : "signIn";
    if (!nonce) throw new Error("Chyb\xED bezpe\u010Dn\xFD n\xE1vrat do Poci\u0165\xE1tka.");
    await loadGoogleIdentity();
    show(action === "link" ? "Vyberte Google \xFA\u010Det, ke kter\xE9mu chcete trvale p\u0159ipojit toto UID." : "Vyberte Google \xFA\u010Det pro p\u0159ihl\xE1\u0161en\xED do Poci\u0165\xE1tka.");
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce,
      auto_select: false,
      callback(response) {
        try {
          if (!response?.credential) throw new Error("Google neposlal p\u0159ihla\u0161ovac\xED token.");
          returnUrl.hash = new URLSearchParams({
            "pocitatko-auth": encodePayload({ nonce, idToken: response.credential })
          }).toString();
          show("Hotovo, vrac\xEDm se do Poci\u0165\xE1tka\u2026");
          location.replace(returnUrl.href);
        } catch (error) {
          show(error?.message || "P\u0159ihl\xE1\u0161en\xED se nezda\u0159ilo.", true);
        }
      }
    });
    window.google.accounts.id.renderButton(document.getElementById("google-button"), {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: action === "link" ? "continue_with" : "signin_with",
      shape: "pill",
      locale: "cs"
    });
  }
  run().catch((error) => show(error?.message || "P\u0159ihl\xE1\u0161en\xED se nezda\u0159ilo.", true));
})();
