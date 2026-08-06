import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
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

export function createFirestoreAdapter() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app);
  const listeners = new Set();
  let user = auth.currentUser;
  let authReady = false;

  const ready = new Promise((resolve) => {
    onAuthStateChanged(auth, (nextUser) => {
      user = nextUser;
      if (!authReady) {
        authReady = true;
        resolve(publicUser(user));
      }
      listeners.forEach((listener) => listener(publicUser(user)));
    });
  });

  return {
    ready,
    currentUser: () => publicUser(user),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
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
