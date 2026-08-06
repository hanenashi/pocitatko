import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore/lite";
import { firebaseConfig } from "../core/firebase-config.js";

function publicUser(user) {
  return user
    ? { uid: user.uid, email: user.email || "", displayName: user.displayName || "" }
    : null;
}

function prefersRedirectSignIn() {
  const touchFirst = navigator.maxTouchPoints > 0 &&
    !window.matchMedia("(hover: hover)").matches;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || touchFirst;
}

const AUTH_HASH_KEY = "pocitatko-auth";
const AUTH_NONCE_KEY = "pocitatko.firebase.authNonce";

function encodeNonce() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function consumeBridgeCredential() {
  const params = new URLSearchParams(location.hash.slice(1));
  const encoded = params.get(AUTH_HASH_KEY);
  if (!encoded) return null;
  params.delete(AUTH_HASH_KEY);
  const cleanHash = params.toString();
  history.replaceState(null, "", `${location.pathname}${location.search}${cleanHash ? `#${cleanHash}` : ""}`);
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(base64));
  } catch {
    return { error: "AUTH_BRIDGE_INVALID_RESPONSE" };
  }
}

export function createFirestoreAdapter() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app);
  const listeners = new Set();
  let user = auth.currentUser;
  let authReady = false;
  let authError = null;
  const bridgeCredential = consumeBridgeCredential();

  function notifyListeners() {
    listeners.forEach((listener) => listener(publicUser(user)));
  }

  const ready = new Promise((resolve) => {
    onAuthStateChanged(auth, (nextUser) => {
      user = nextUser;
      if (!authReady) {
        authReady = true;
        resolve(publicUser(user));
      }
      notifyListeners();
    });
  });

  if (bridgeCredential) {
    const expectedNonce = sessionStorage.getItem(AUTH_NONCE_KEY);
    sessionStorage.removeItem(AUTH_NONCE_KEY);
    if (bridgeCredential.error || !expectedNonce || bridgeCredential.nonce !== expectedNonce || !bridgeCredential.idToken) {
      authError = new Error(bridgeCredential.error || "AUTH_BRIDGE_INVALID_RESPONSE");
      notifyListeners();
    } else {
      signInWithCredential(auth, GoogleAuthProvider.credential(bridgeCredential.idToken)).catch((error) => {
        authError = error;
        notifyListeners();
      });
    }
  }

  return {
    ready,
    currentUser: () => publicUser(user),
    authError: () => authError,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      authError = null;
      const provider = new GoogleAuthProvider();
      if (prefersRedirectSignIn()) {
        const nonce = encodeNonce();
        sessionStorage.setItem(AUTH_NONCE_KEY, nonce);
        const returnUrl = `${location.origin}${location.pathname}${location.search}`;
        const bridgeUrl = new URL("/auth/", `https://${firebaseConfig.authDomain}`);
        bridgeUrl.searchParams.set("returnUrl", returnUrl);
        bridgeUrl.searchParams.set("nonce", nonce);
        location.assign(bridgeUrl.href);
        return null;
      }
      const result = await signInWithPopup(auth, provider);
      return publicUser(result.user);
    },
    async signOut() {
      await signOut(auth);
    },
    async saveRound(snapshot, clubName) {
      await ready;
      if (!user) throw new Error("AUTH_REQUIRED");
      const clubRef = doc(database, "clubs", snapshot.clubId);
      const roundRef = doc(clubRef, "rounds", String(snapshot.source.postId));
      const batch = writeBatch(database);
      batch.set(
        clubRef,
        {
          clubId: snapshot.clubId,
          name: clubName,
          schemaVersion: snapshot.schemaVersion,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      batch.set(roundRef, { ...snapshot, savedAt: serverTimestamp() });
      await batch.commit();
      return { path: `clubs/${snapshot.clubId}/rounds/${snapshot.source.postId}` };
    },
  };
}
