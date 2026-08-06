# Pociťátko handoff (Codex CLI)

## TL;DR

Pociťátko `v0.5.7` restores the exact reviewed screen after the hosted Google redirect. Google/Firebase authentication keeps a stable UID through the credential bridge, Firestore writes are allowlisted, and an owner-only admin console is available to the verified Firebase account `hanenashi@gmail.com`.

PRs #2 and #3 are merged. Local `main` and `origin/main` are both at `c0920d8` (`Merge pull request #3 from hanenashi/agent/owner-admin-console`). The working tree was clean at handoff time.

## Machine and repository

- Machine: Akai (Windows)
- Local checkout: `C:\TEMP\pocitatko-review`
- GitHub: `hanenashi/pocitatko`
- Firebase project: `pocitatko-7541f`
- Current source version: `0.5.7`
- Generated userscript: `pocitatko.user.js`
- Chrome/Tampermonkey was manually updated to v0.5.6 and live-tested on `https://www.okoun.cz/boards/vymysli_vtipny_textik`.

## Authentication and authorization

- Google and Anonymous Firebase Auth providers are enabled.
- Firebase Hosting serves the credential-only auth bridge under `/auth/`.
- Google recovery/linking was tested successfully: the user can sign out and recover the linked Firebase identity.
- Firestore owner identity is a verified token with email exactly `hanenashi@gmail.com`.
- Owner can list/create/update/delete `admins/{uid}` documents and can always write rounds.
- Ordinary admins can write only when their document exists and contains `enabled: true`.
- Ordinary admins cannot list or manage other admins.
- Club and round results are publicly readable; writes require owner/admin authorization; client deletes are denied.
- Okoun usernames and admin-document email fields are labels only, never authentication evidence.

Current live admin entry:

- Firebase UID: `BOnOPM3Jc5Z0sYzUEtcCflmaxDJ3`
- Label email: `hanenashi@gmail.com`
- Okoun label: `Blasnik`
- `enabled: true`

Older/deleted UIDs (`prxK9YsRJYZWfFMEV4l54NxnNXl2` and `byodRFAT7QSDWL5h3yR7hcAuMSk1`) were removed. The admin list contains exactly the current UID above.

## Owner admin console

The overlay shows `Správa adminů` only when `canManageAdmins()` sees the verified owner email. Firestore rules are the actual security boundary.

The console can:

- list admin documents;
- add an admin by Firebase UID;
- attach optional Google-email and Okoun-user labels;
- edit labels;
- enable or disable access; and
- refresh the list.

Relevant files:

- `src/adapters/firestore.js`
- `src/ui/overlay.js`
- `src/ui/styles.js`
- `firestore.rules`
- `tests/firestore-rules.test.mjs`
- `FIREBASE.md`

## Live verification completed

- Pociťátko overlay reported v0.5.6.
- Owner-only admin console opened for `hanenashi@gmail.com`.
- Admin list read/write and enable/disable behavior worked.
- Correct current UID was saved and the stale QA UID was removed.
- Round calculation still worked for the PetaKlic round.
- Firestore save succeeded at `clubs/vymysli_vtipny_textik/rounds/1074685846`.
- No new Pociťátko console errors appeared during the final run. Remaining warnings were old failed-write history or unrelated browser-extension/MetaMask messages.
- Firestore rules were deployed to the live project.

## Checks already run

- `npm run build` / `scripts/build.mjs`: passed
- generated-file check / `scripts/check-generated.mjs`: passed
- JavaScript syntax checks for the adapter and overlay: passed
- `git diff --check`: passed
- Firestore rules dry-run compilation: passed
- Live Firestore rules deployment: passed

The Firestore emulator test suite is written but was not executed on Akai because Java is not installed. Do not treat that as a rules failure; install Java first, then run `npm run test:rules` if emulator coverage is needed.

## GitHub state

- PR #2, permanent Google-linked UID: merged as `80a4884`
- PR #3, owner-only admin console: merged as `c0920d8`
- `main` was synchronized with `origin/main` after the merge.

## Safe next steps

1. Start by reading `README.md`, `FIREBASE.md`, `firestore.rules`, and this file.
2. Check `git status` before editing; preserve any user changes.
3. Make source edits under `src/`, rebuild `pocitatko.user.js`, and run the generated-file check.
4. If rules change, run the emulator tests after Java is available and deploy only after review.
5. Never commit `.env`, Firebase login state, service-account keys, tokens, or Beechan secret files. Firebase Web configuration in the built userscript is public routing configuration, not an authorization secret.
