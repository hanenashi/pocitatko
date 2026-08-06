import { initializeApp } from "firebase/app";
import {
  getRedirectResult,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

export function createFirestoreAdapter() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app);
  const listeners = new Set();
  let user = auth.currentUser;
  let authReady = false;
  let authError = null;

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

  getRedirectResult(auth).catch((error) => {
    authError = error;
    notifyListeners();
  });

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
        await signInWithRedirect(auth, provider);
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
