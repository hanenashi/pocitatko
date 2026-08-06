# Firebase setup

Pociťátko uses Firebase's browser SDK. The Firebase Web configuration is public
application routing information and is embedded in the generated userscript;
authorization comes from Firebase Authentication and Firestore Security Rules.

## Live project status

As of 6 August 2026, project `pocitatko-7541f` has:

- the default Firestore database and API active;
- the repository's emulator-tested `firestore.rules` deployed;
- Google Authentication active;
- code support for an optional anonymous per-browser identity (enable the
  Anonymous provider before use);
- `www.okoun.cz` present in Authentication's authorized domains; and
- a first-party mobile authentication bridge under Firebase Hosting; and
- public round reads reachable while anonymous writes remain denied;
- the first moderator UID allowlisted; and
- live round `clubs/vymysli_vtipny_textik/rounds/1074685846` saved from Kiwi.

The initial end-to-end bootstrap is complete. Future moderators still need an
explicit `admins/{uid}` allowlist document before their first write. No Admin
SDK private key is required.

## Console setup

1. Create the default Cloud Firestore database in production mode.
2. Under Authentication, enable the Google and Anonymous sign-in providers.
3. Add `www.okoun.cz` to Authentication's authorized domains.
4. Deploy the repository's `firestore.rules` in Firestore's Rules tab.
5. Deploy Firebase Hosting from this repository so `/auth/` can complete
   mobile sign-in without relying on blocked third-party browser storage.
6. Open a reviewed round in Pociťátko and either sign in through the Google
   bridge or request a UID for the current browser profile.
7. Copy the UID displayed in the round's DB status.
8. In Firestore, create collection `admins` and a document whose document ID is
   that UID. A simple field such as `enabled: true` is sufficient; optional
   fields such as `okounUser` and `role` are descriptive only. The rules use
   document existence as the allowlist.
9. Press `Uložit do DB`. The first successful save creates the club and round
   documents.

For the current project, steps 1–9 are complete. The first live save was also
read back anonymously to verify the public historical-results path.

Do not switch to blanket public-write rules. Signing in does not grant write
access unless the matching admin document exists.

The verified Firebase account `hanenashi@gmail.com` is the sole allowlist
owner. Its in-app `Správa adminů` console can list, add, label, enable, and
disable `admins/{uid}` documents. Firestore rules enforce this owner email and
the verified-email claim; the button is not the security boundary. Ordinary
admins cannot grant access. Admin authorization requires `enabled: true`.

Google bridge identities follow the moderator across browsers after Google
sign-in. A moderator who starts with an allowlisted anonymous identity can use
`Zachovat UID přes Google` before signing out or clearing browser storage. This
links Google to the existing account without changing its UID, so the existing
`admins/{uid}` entry keeps working and the identity becomes recoverable.
Unlinked anonymous identities remain device-local: clearing browser storage or
using another browser profile creates a new UID that must be allowlisted
separately. The visible Okoun username may be shown as an audit hint, but it is
never accepted as proof of identity by Firestore.

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
npx firebase-tools deploy --only hosting,firestore:rules
```
