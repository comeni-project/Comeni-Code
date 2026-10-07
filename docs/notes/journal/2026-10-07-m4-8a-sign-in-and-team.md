# 2026-10-07 — M4.8a, sign-in and the team

## Where things stand

- **M4.8 is in three parts** (agreed with the operator): M4.8a sign-in and the team (#220, this),
  M4.8b the workbench (#221), M4.8c the exam pool (#222). #126's five screens did not fit in a few
  sessions (R5). The parts table is in the M4.8a spec.
- **M4.8a was designed and built the same day.** The spec and plan are PR #233; the build is on
  `feat/m4-8a-sign-in-and-team`, sub-issues #223–#232 of #220, with the checkpoint review's and
  the walk's findings in #234. The boards L14 Sign in, L15 Join and S14 Team were added to
  `.design/build_pages.mjs` and approved on their own canvas
  (https://claude.ai/artifact/5M6KvcydPMWpVLAG9QQ6Jx).
- **Checked.** 1037 Python tests pass with CI's environment, with mypy, ruff, Django's checks and
  the migration check; the web app's lint, typecheck, 296 tests and build pass in `node:24-alpine`.
- **Walked in Chrome** against `runserver` and the production build: signed out shows Sign in and
  Create an account shows *not yet*; an operator invited by `invite_operator` creates an account
  and lands on Team; invites an author, who lands in Studio with *Nothing in Studio for your role
  yet*; the operator changes the author's role and withdraws a second invite; signing out returns
  to Start; `/studio/team` signed out goes to Sign in and back after signing in.

## What changed

- M4.8a.1 (f7d7ee4): sign-in providers are a table (`config/providers.py`); `social_providers`
  and `Env`'s pair check read it.
- M4.8a.2–3 (0456ed8, 29b7670): `sendJson` with the CSRF token; `api/auth.ts` (allauth, refusals
  as `FormRefused` by field), `api/accounts.ts` (`/api/me`, invites, team, `canActAs`), `useMe`;
  `test-kit.tsx` answers fetch by method and path.
- M4.8a.4–6 (ec17ced, 5661a0a, 4201223): Sign in with a button per provider allauth reports,
  password reset, Join with an invite, and `NotYet` for every way in without one.
- M4.8a.7 (6c0b537): the account button and menu; the logo moved into `Mark`. 261e5fe put back a
  read's 204 as a failure (task 2 had changed `getJson`).
- M4.8a.8–9 (62e31cb, dd8e3ec): the Studio shell with one gate and a rail from `STUDIO_PAGES`;
  Team.
- #234 (a2b7957, c18474b, 6c07aef): `safeNext` parses addresses; `/api/me` hands out the CSRF
  cookie; words for a deactivated account and a rate limit; Join shows the address's error; signing
  out is a full load of Start; smaller fixes from the walk.

## Decisions, and why

The spec holds them with what was rejected (M4S.1–M4S.6) and its notes from the build. With the
operator: *Sign in* for everyone now, with an honest *not yet* (b), since learner accounts will
come; providers as data with no per-provider code ("clever design patterns to have both without
much redundant code"); new boards built from the generator's existing helpers ("you should
already have many mockups!"). In the build: the CSRF cookie comes from `/api/me`, not a pre-fetch
in every write; signing out reloads Start, because the router's transition let the Studio gate
redirect first.

## What is next

1. Merge #233 (spec and plan), then this branch, on the operator's yes; update #74.
2. Compact this entry (M4.8a closes).
3. M4.8b's brainstorm: the workbench (#221), against the Workbench board, adding the drafts to
   `STUDIO_PAGES`.
