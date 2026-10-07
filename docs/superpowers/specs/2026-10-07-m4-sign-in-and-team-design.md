# M4.8a — Sign-in and the team

**Status: agreed 2026-10-07.** The first slice of M4.8 (#126), M4's first screens. Designed with
the operator in conversation on 2026-10-07, section by section; the boards were approved on a
canvas of their own. The accounts API is M4.3's (archived spec `2026-10-05-m4-accounts-design.md`):
invite-only sign-up through allauth's headless API, `/api/me`, and the team routes. This part
draws them.

**M4.8 is split in three** (agreed 2026-10-07), each with its own spec, plan and pull request,
because #126's five screens do not fit in a few sessions (R5):

| Part | Screens | Checked when |
|---|---|---|
| **M4.8a** (this) | Sign in, Join, Team (S14), the Studio shell | an operator invites someone, who accepts and lands in Studio |
| M4.8b | the workbench's Content tab, Resources, Checks, Preview, Submit | an author drafts a node until the checklist passes, and submits it |
| M4.8c | the exam pool's question builder | a node gets its exam questions and still passes its checks |

It decides:

- that *Sign in* is offered to everyone, with an honest *not yet* for learners (M4S.1);
- one path for every sign-in provider, on both sides (M4S.2);
- one auth module and one *who am I* answer in the web app (M4S.3);
- the Studio shell: one gate, and a rail from a table (M4S.4);
- the Team page (M4S.5);
- the boards, the build and *done when* (M4S.6).

---

## M4S.1 Sign in for everyone; *not yet* for learners

**Decided: the top bar shows *Sign in* to everyone signed out.** Learner accounts will come, and
the operator wants the door in place now (rejected: hiding sign-in until then, reachable only
from Studio's links — it would need redesigning when learners arrive).

Sign-up stays invite-only (M4A.2). Every way a person without an invite tries to make an account
ends at **one component, `NotYet`**: *Learner accounts are coming. Everything in Comeni Code works
without one. On the team? Open the link in your invite email.*

- `/join` without a token: `NotYet`.
- `/sign-in/error` (allauth's redirect after a provider sign-in it refused, M4A.3): `NotYet` when
  the provider account is unknown (sign-up closed); otherwise a sentence saying the sign-in did not
  finish, with a way back to Sign in.

When learner accounts open, the adapter's `is_open_for_signup` stops requiring an invite and
`NotYet` is deleted; no other screen changes.

Signed in, the avatar opens the account menu from the `AccountMenu` board, trimmed to what exists:
the name and address, **Open Studio** (shown only to members with a role), **Sign out**. Your
knowledge, routes, problems, Theme and Settings arrive with their phases.

## M4S.2 One path for every provider

The operator asked that a second provider (ORCID) cost no redundant code. **Each side has one
path, and a provider is data:**

- **API — a provider registry.** `config/auth.py`'s `github_providers` becomes
  `social_providers(env)` over a table, `PROVIDERS`: one `Provider` record per provider, with its
  allauth id, the two `Env` fields holding its client id and secret, and its scopes. allauth's
  `SOCIALACCOUNT_PROVIDERS` holds every provider whose pair is set. `Env`'s *set both or neither*
  check runs once over the same table, so the rule is written once. Today the table has one
  entry, GitHub; ORCID is one entry and two `Env` fields when its keys exist.
- **Web — buttons from allauth's config.** `GET /_allauth/browser/v1/config` lists the configured
  providers (id and name). The sign-in and join pages draw **one `ProviderButton` per entry**, and
  every button calls one function, `continueWith(providerId, next)`, which posts allauth's
  provider-redirect form (`/_allauth/browser/v1/auth/provider/redirect`, `process=login`). Nothing
  in the web app names a provider; GitHub's mark is the one per-provider asset, looked up by id
  with a plain fallback.

The same button signs in a known account and, with an invite held in the session, creates one:
whether sign-up is allowed is decided only by the adapter (M4A.2), never by the screen.

*Rejected:* a component per provider, and a hard-coded GitHub button — the redundancy the
operator asked to avoid; allauth's own per-provider settings pages — headless mode has none.

## M4S.3 One auth module, one *who am I*

- **`api/client.ts`** gains `sendJson(method, url, body?)`, the one way to write: it sends the
  `X-CSRFToken` header from Django's `csrftoken` cookie (readable by design; the session cookie is
  HttpOnly) and words failures the way `getJson` does.
- **`api/auth.ts`** wraps allauth's headless calls: `fetchAuthConfig`, `signIn`, `signUp`,
  `signOut`, `requestPasswordReset`, `resetPassword`, `continueWith`. allauth answers errors as
  `{errors: [{message, param}]}`; `auth.ts` turns them into one `FormRefused` error holding the
  messages by field, so a form shows each beside its input.
- **`api/team.ts`** wraps the accounts API: the invite lookup and accept, the team's members and
  invites, and their changes.
- **`api/queries.ts`** keeps every key (spec M4R.5): `me`, `authConfig`, `invite(token)`,
  `teamMembers`, `teamInvites`. Every auth mutation (sign in, sign up, sign out) invalidates `me`;
  every team change invalidates the two team keys. **`useMe()` is the one answer** the top bar,
  the account menu, the Studio gate and the Team page read.

**Password reset is in this part**, since Sign in links to it: `/reset-password` asks for the
address (allauth mails a link, and mails nobody for an unknown address, M4.3);
`/reset-password/:key` sets the new password. Both reuse the sign-in card; neither has a board of
its own.

## M4S.4 The Studio shell

**One gate.** Every `/studio/*` route renders inside `StudioShell`, which reads `useMe()`:

| `useMe()` | Shows |
|---|---|
| loading | the shell's frame, nothing inside |
| signed out | redirect to `/sign-in?next=<path>` |
| signed in, no role, or below the page's role | *Studio is for the team* (with the role it needs) |
| otherwise | the page |

The API keeps its own `studio(min_role)` on every route (M4A.4): the gate decides what the screen
shows, never what is allowed. A 401 or 403 from a Studio query is shown as the API words it.

**A rail from a table.** `studio/pages.ts` holds `STUDIO_PAGES`: per page its path, label, icon
and minimum role. The rail draws the entries the member's role can open, and the gate checks the
same entry, so a page is added in one place. **This part's table has one entry, Team
(operator).** M4.8b adds the drafts. The rail's other items on the boards (Inbox, Requests, Graph…)
appear when their pages are built — never as dead links.

`/studio` itself opens the first page in the table the member can open; with none (an author,
until M4.8b) it shows the shell with *Nothing in Studio for your role yet.*

The shell's top bar is the boards': the mark with *Studio*, search (inert until a later part; drawn
as on the boards but not focusable), *Back to Learn*, and the account button.

## M4S.5 Team (S14)

One page, `/studio/team`, operators only, as on the S14 board:

- **Invite someone**: email and a role switch (Author · Reviewer · Operator), *Send invite*. The
  API mails a one-use link for 7 days (in development, to the console). An address that is already
  a member is refused as the API words it (CA0107).
- **Members**: name, email, a role switch, status, *Deactivate*. Your own row says *you* and has no
  actions. Changing a role or deactivating answers at once from the API; the last-operator refusal
  (CA0108) is shown above the table as the API words it, and the switch returns to the stored
  role.
- **Pending invites**: address, role, expiry, *Withdraw*.

**Deactivating asks once, in place**: the button becomes *Deactivate [name]? Confirm · Cancel* in
its row (no dialog). The account and its history stay (M4A.4), but nothing in Studio can undo it
yet: *Reactivate* is not in the API and not on the board, and waits for a need.

## M4S.6 The boards, the build and *done when*

**Boards.** Three were added to `.design/build_pages.mjs` and approved on 2026-10-07: **L14 Sign
in**, **L15 Join** (with an invite, and without), **S14 Team**. The Studio shell is the boards'
existing `studio()` frame; the account menu is `AccountMenu`, trimmed (M4S.1).

**Routes** (in `App.tsx`): `/sign-in`, `/sign-in/error`, `/join`, `/join/:token`,
`/reset-password`, `/reset-password/:key`, `/studio`, `/studio/team`. They are the addresses
allauth's `HEADLESS_FRONTEND_URLS` and the invite links already point at (M4A.3).

**Folders** (small files, one job each): `src/account/` (the sign-in, join and reset pages,
`NotYet`, `ProviderButton`, the account menu, the card and field they share) and `src/studio/`
(`StudioShell`, `pages.ts`, and `team/` with the page and its three panels).

**Tests.** pytest for the provider registry and its `Env` check. vitest for every component and
for `auth.ts`, `team.ts` and `sendJson` with `fetch` stubbed: the gate's four rows, the rail
filtered by role, `NotYet` on every way in, provider buttons drawn from the config, errors beside
their fields, the Team page's changes and refusals.

**Done when**, in a browser against the running stack, beside the boards (light at 1440, and dark):

1. Signed out, the top bar shows *Sign in*; *Create an account* shows *Learner accounts are
   coming*.
2. An operator (`invite_operator`) signs in, opens Studio → Team, and invites an author.
3. The invitee opens the link from the console mail, creates an account with a password, and lands
   in Studio as an author (*Nothing in Studio for your role yet* until M4.8b).
4. The operator sees the new member, changes their role, withdraws a second invite, and is refused
   when demoting themselves as the last operator.
5. Signing out returns the top bar to *Sign in*; `/studio/team` then sends you to Sign in.

GitHub sign-in is checked by its tests and by the button's redirect; a real round trip needs an
OAuth app, which is registered only with the operator (M4.9).

## Not in this part

ORCID itself (one registry entry when its keys exist); changing your email or name; reactivating
a member; learner accounts and their menu items; the Studio search; every Studio page but Team.
