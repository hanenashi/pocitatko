import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

let environment;
const OWNER_EMAIL = "hanenashi@gmail.com";

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "pocitatko-rules-test",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});

beforeEach(async () => environment.clearFirestore());
after(async () => environment?.cleanup());

async function addAdmin(uid) {
  await environment.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), "admins", uid), { enabled: true }),
  );
}

function validClub() {
  return { clubId: "vymysli_vtipny_textik", name: "Vymysli vtipný textík", schemaVersion: 1 };
}

function validRound() {
  return {
    clubId: "vymysli_vtipny_textik",
    roundId: "vymysli_vtipny_textik:123",
    source: { postId: 123 },
    schemaVersion: 1,
  };
}

test("club and round reads are public", async () => {
  const database = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(database, "clubs", "vymysli_vtipny_textik")));
  await assertSucceeds(getDoc(doc(database, "clubs", "vymysli_vtipny_textik", "rounds", "123")));
});

test("anonymous and ordinary authenticated users cannot write", async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  const ordinary = environment.authenticatedContext("ordinary-user").firestore();
  await assertFails(setDoc(doc(anonymous, "clubs", "vymysli_vtipny_textik"), validClub()));
  await assertFails(setDoc(doc(ordinary, "clubs", "vymysli_vtipny_textik"), validClub()));
});

test("allowlisted admin can save a matching club and round", async () => {
  await addAdmin("moderator");
  const database = environment.authenticatedContext("moderator").firestore();
  await assertSucceeds(setDoc(doc(database, "clubs", "vymysli_vtipny_textik"), validClub()));
  await assertSucceeds(
    setDoc(doc(database, "clubs", "vymysli_vtipny_textik", "rounds", "123"), validRound()),
  );
});

test("disabled allowlist document does not grant write access", async () => {
  await environment.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), "admins", "disabled-moderator"), { enabled: false }),
  );
  const database = environment.authenticatedContext("disabled-moderator").firestore();
  await assertFails(setDoc(doc(database, "clubs", "vymysli_vtipny_textik"), validClub()));
});

test("verified owner is an admin without an allowlist document", async () => {
  const owner = environment.authenticatedContext("owner", {
    email: OWNER_EMAIL,
    email_verified: true,
  }).firestore();
  await assertSucceeds(setDoc(doc(owner, "clubs", "vymysli_vtipny_textik"), validClub()));
});

test("round identity must match its Firestore path", async () => {
  await addAdmin("moderator");
  const database = environment.authenticatedContext("moderator").firestore();
  await assertFails(
    setDoc(doc(database, "clubs", "vymysli_vtipny_textik", "rounds", "999"), validRound()),
  );
});

test("clients cannot delete published data", async () => {
  await addAdmin("moderator");
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "clubs", "vymysli_vtipny_textik"), validClub());
  });
  const database = environment.authenticatedContext("moderator").firestore();
  await assertFails(deleteDoc(doc(database, "clubs", "vymysli_vtipny_textik")));
});

test("admin allowlist documents stay private from ordinary admins", async () => {
  await addAdmin("moderator");
  const moderator = environment.authenticatedContext("moderator").firestore();
  const other = environment.authenticatedContext("other").firestore();
  await assertSucceeds(getDoc(doc(moderator, "admins", "moderator")));
  await assertFails(getDoc(doc(other, "admins", "moderator")));
  await assertFails(getDocs(collection(moderator, "admins")));
  await assertFails(setDoc(doc(moderator, "admins", "another"), { enabled: true }));
  assert.ok(true);
});

test("verified owner can list, add, disable, and delete admins", async () => {
  await addAdmin("moderator");
  const owner = environment.authenticatedContext("owner", {
    email: OWNER_EMAIL,
    email_verified: true,
  }).firestore();
  await assertSucceeds(getDocs(collection(owner, "admins")));
  await assertSucceeds(setDoc(doc(owner, "admins", "new-admin"), {
    enabled: true,
    email: "admin@example.com",
  }));
  await assertSucceeds(setDoc(doc(owner, "admins", "new-admin"), {
    enabled: false,
  }, { merge: true }));
  await assertSucceeds(deleteDoc(doc(owner, "admins", "new-admin")));
});

test("unverified owner email cannot manage admins", async () => {
  const impostor = environment.authenticatedContext("impostor", {
    email: OWNER_EMAIL,
    email_verified: false,
  }).firestore();
  await assertFails(setDoc(doc(impostor, "admins", "new-admin"), { enabled: true }));
});

test("owner must store an explicit boolean enabled field", async () => {
  const owner = environment.authenticatedContext("owner", {
    email: OWNER_EMAIL,
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(owner, "admins", "missing-enabled"), { email: "admin@example.com" }));
});
