import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

let environment;

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

test("admin allowlist documents stay private and console-managed", async () => {
  await addAdmin("moderator");
  const moderator = environment.authenticatedContext("moderator").firestore();
  const other = environment.authenticatedContext("other").firestore();
  await assertSucceeds(getDoc(doc(moderator, "admins", "moderator")));
  await assertFails(getDoc(doc(other, "admins", "moderator")));
  await assertFails(setDoc(doc(moderator, "admins", "another"), { enabled: true }));
  assert.ok(true);
});
