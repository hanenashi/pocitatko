# Firebase setup

Pociťátko uses Firebase's browser SDK. The Firebase Web configuration is public
application routing information and is embedded in the generated userscript;
authorization comes from Firebase Authentication and Firestore Security Rules.

## Live project status

As of 6 August 2026, project `pocitatko-7541f` has:

- the default Firestore database and API active;
- the repository's emulator-tested `firestore.rules` deployed;
- Google Authentication active;
- `www.okoun.cz` present in Authentication's authorized domains; and
- public round reads reachable while anonymous writes remain denied.

The remaining one-time bootstrap needs an interactive browser session: sign in
from Pociťátko, obtain the Firebase UID, create its `admins/{uid}` allowlist
document, and save one reviewed round. No Admin SDK private key is required.

## Console setup

1. Create the default Cloud Firestore database in production mode.
2. Under Authentication, enable the Google sign-in provider.
3. Add `www.okoun.cz` to Authentication's authorized domains.
4. Deploy the repository's `firestore.rules` in Firestore's Rules tab.
5. Open a reviewed round in Pociťátko and press `Přihlásit k DB`.
6. Copy the UID displayed in the round's DB status.
7. In Firestore, create collection `admins` and a document whose document ID is
   that UID. A simple field such as `enabled: true` is sufficient; the rules
   use document existence as the allowlist.
8. Press `Uložit do DB`. The first successful save creates the club and round
   documents.

For the current project, steps 1–4 are complete. Resume at step 5 during the
next Kiwi live-testing session.

Do not switch to blanket public-write rules. Signing in does not grant write
access unless the matching admin document exists.

## Stored paths

```text
admins/{firebaseUid}
clubs/{clubId}
clubs/{clubId}/rounds/{sourceOkounPostId}
```

Club and round documents are publicly readable for future historical and live
statistics. Admin documents are readable only by their matching signed-in
user. Client deletion is denied.

Each saved round contains its normalized source, boundary, ranked entries,
reaction evidence, manual exclusions, suggested winner, selected winner, and a
server timestamp. This includes public Okoun usernames and current avatar URLs.

## Local configuration

Copy `.env.example` to `.env` and fill in the Firebase Web app values. `.env`
is ignored by Git and must never contain service-account credentials. Build
substitution embeds the Web configuration into `pocitatko.user.js`:

```sh
npm install
npm run build
npm run check
```
