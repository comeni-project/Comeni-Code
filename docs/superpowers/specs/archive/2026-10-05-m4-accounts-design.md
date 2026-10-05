# M4.3 — Accounts, invites and roles

**Status: agreed 2026-10-05.** The third part of M4 (#74), issue #121. Designed with the operator in
conversation on 2026-10-05, section by section. It builds what the M4 parts list decided (the
archived *M4 in parts* entry): sign-in by email and password or GitHub through django-allauth
(R1), invite-only, the three roles of W7.1, and users keyed so #101 stays open.

It decides:

- the user, and how roles rank (M4A.1);
- how an invite is made, accepted and refused (M4A.2);
- how the web app signs in, and how a session is kept (M4A.3);
- how a Studio route is gated, and what learners need (M4A.4);
- tests and *done when* (M4A.5).

**No screens.** Sign-in and Team are M4.8. This part is the API those screens will call, proved by
tests, with the first operator invited from the command line.

---

## M4A.1 The user and its role

`accounts.User` is today an empty `AbstractUser`. It becomes:

- **Email is the identity.** Sign-in is by email (or GitHub); the `username` field goes, now, while
  no user depends on it. Email is unique, compared case-insensitively.
- **`public_id`**, a UUID set at creation and never reused. It is **the key for #101**: a future
  OIDC provider issues it as the subject (`sub`), and a shared identity service maps it. The
  integer key stays internal; the API and anything outside the database name a user by
  `public_id`.
- **`name`**, one display name, filled from GitHub on a GitHub sign-up. Django's first and last
  name go.
- **`role`**: `author`, `reviewer` or `operator`, **ranked** — operator includes reviewer, which
  includes author — or blank for no Studio role. M4.3 makes only team accounts; blank is where
  M8's learner accounts land, with no schema change.

**One check:** `Role` is an enum in rank order, and `user.can_act_as(Role.REVIEWER)` is true for
that role and above. Nothing else compares roles. *Nobody approves what they drafted* (W7.1) is
a rule about items, enforced in M4.5, not a role.

**The team, for operators** (the API M4.8's Team page calls): list members (public id, email,
name, role, active); change a member's role; deactivate one (the account and its history stay;
it can no longer sign in). **The last active operator cannot be demoted or deactivated**, so
Studio never locks itself out.

**The first operator:** `manage.py invite_operator <email>` makes an operator invite and prints its
link, so the first operator signs up through the same path as everyone else.

*Rejected:* **separate roles**, any set per person (a reviewer who cannot draft): a set per user and
a check per role, which pays only once a team has pure reviewers. **Keeping `username`**: a second
identifier nobody signs in with. **Django's admin** for the team: not installed, and M4.8 draws
Team to the board.

## M4A.2 Invites

An **`Invite`**: `email`, `role`, `invited_by` (empty from the command), `created_at`,
`expires_at`, then `accepted_at` and `accepted_by`, or `revoked_at`; and **a token kept only as its
SHA-256 hash** — the plain token exists only in the link, so the table cannot be turned into
sign-ups. An invite is **pending** while it is not accepted, revoked or expired. It is single-use
and lasts **7 days**.

**For operators** (`/api/team/invites`): invite an email with a role, which sends a message with
`<CODE_WEB_ORIGIN>/join/<token>`; a new invite to an address with a pending one revokes the old;
inviting a member is a **409** (change their role instead). List pending invites; revoke one.

**For the invitee:**

1. `GET /api/invites/<token>`, with no account: the invite's email and role. Unknown is **404**;
   expired, revoked or used is **410**, with a `code` saying which.
2. `POST /api/invites/<token>/accept` puts the invite in the session.
3. Sign-up through allauth's headless API (M4A.3):
   - **with a password**, the email must be the invite's. The link proved they receive mail
     there, so no second verification is sent;
   - **with GitHub**, the account takes **the invite's email**, whatever GitHub reports, so Team
     lists the address the operator invited. GitHub's own address stays on the social account.
4. The new user takes the invite's role, and the invite is marked accepted, in one transaction.

**The gate:** allauth's adapter opens sign-up only while the session holds a pending invite. Any
other sign-up, by password or GitHub, is refused; a GitHub sign-in with no linked account and no
invite creates nothing.

*Rejected:* **matching GitHub sign-ups by email**. It needs no link, but fails for anyone whose
GitHub address differs from the invited one, found only when they try.

## M4A.3 Sign-in and the session

**allauth in headless mode, browser client only.** Its JSON API is at `/_allauth/browser/v1/…`:
sign-up, login, logout, the session, and the GitHub redirect and callback. `HEADLESS_ONLY` turns
off allauth's HTML pages; the "app" client (for native apps) stays off. Where allauth sends a
browser back — after GitHub, or on an error — it points at `CODE_WEB_ORIGIN` routes M4.8 draws.
allauth's default rate limits on login stay on. **GitHub is configured only when its client id and
secret are set**; without them it is off, so a local stack runs with no GitHub OAuth app.

**The session:** Django's session cookie, HttpOnly, SameSite=Lax, Secure when `CODE_SECURE_COOKIES`
is on, two weeks. **Writes need Django's CSRF token**: the web app reads the `csrftoken` cookie and
sends `X-CSRFToken`, for allauth's endpoints and our gated routes alike.

**`GET /api/me`** answers `{"user": null}` for nobody, or the user's public id, email, name and
role. Always 200, so the web app never reads "signed out" as an error.

**Settings**, all `CODE_*`, all in `.env.example`: `CODE_WEB_ORIGIN`, `CODE_SECURE_COOKIES`,
`CODE_GITHUB_CLIENT_ID` and `CODE_GITHUB_CLIENT_SECRET`, and the email backend (the console in
development and tests; SMTP settings ready for a hosted stack).

*Rejected:* **allauth's server-rendered pages** — they work with no screens, but sit outside the
hybrid identity and M4.8 would restyle or replace them. **Our own Ninja endpoints over allauth's
internals** — one API and one schema, but it rewrites the flows allauth already secures (OAuth
state, email checks, rate limits). The cost of headless: allauth's endpoints live outside `/api/`,
with their own OpenAPI document, so the dev proxy and nginx forward `/_allauth` too.

## M4A.4 Access

One Ninja auth class, **`studio(min_role)`**, on every Studio route: nobody signed in is **401**
(`CA0101`), signed in below the role is **403** (`CA0102`), else the request passes. Error bodies
carry a `code`, as the API's already do, in a new band **`CA0100–CA0199 · accounts`**.

- **Learner routes keep no auth**: `/api/nodes`, `/api/routes`, `/api/search`, `/api/health`.
- **A deactivated member is signed out on their next request**: Django's backend will not load an
  inactive user, so the session no longer resolves to them.
- **Wiring:** Vite's dev proxy and `ops/nginx/default.conf` forward `/_allauth` beside `/api`; a
  test reads both, so neither drifts.

## M4A.5 Dependencies, tests and done when

**Dependency:** `django-allauth[socialaccount,headless]`, pinned to `>=65.19,<65.20` as the stack
pins its others. It brings `requests` and `pyjwt` for the GitHub exchange; that is `apps/api`,
outside the purity guard, and nothing in `packages/` changes.

**Tests** (Postgres, the API's test client; nothing reaches GitHub):

- invites: an operator invites and the console mail holds the link; the token is stored hashed;
  lookup is 404 unknown and 410 expired, revoked or used, each with its `code`; a second invite to
  an address revokes the first; inviting a member is 409;
- sign-up by password: invite, accept, sign up, and the user has the invite's role and the invite
  is used; the email must be the invite's; with no invite in the session, sign-up is refused;
- GitHub, through allauth's test client with GitHub's token and user endpoints mocked: with an
  invite, the account takes the invite's email and role; without, it is refused and no user is
  made; a linked account signs in;
- access: each Studio route is 401 signed out, 403 too low and 200 at the role; a write without a
  CSRF token is refused; a deactivated member's session stops working; the last operator cannot
  be demoted or deactivated; every learner route answers without an account;
- wiring: the dev proxy and nginx forward `/_allauth`; `openapi.json` and `schema.ts` are
  regenerated.

**M4.3 is done when:**

1. An invite ends in a sign-up with its role, by password and by GitHub.
2. A gated route answers 401, 403 and 200 for nobody, a lower role and the role.
3. A GitHub sign-in goes through allauth's test client.
4. Learner routes still need no account.
5. The last operator is protected; invites are single-use and expire.
6. `manage.py invite_operator` prints a working link.

## Not in this part

The Sign-in and Team screens (M4.8); the audit log on Team (M4.8's spec); ORCID and learner
accounts (M8); Code as an OIDC provider (#101); two-factor sign-in; changing one's own email.
