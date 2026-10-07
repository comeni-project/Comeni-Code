# M4.8a — Sign-in and the team: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in, join through an invite, and the Team page (S14) in the web app, inside a Studio
shell with one gate; the API's sign-in providers become a registry.

**Architecture:** The API already serves everything (M4.3): allauth's headless browser API under
`/_allauth/browser/v1/`, and the accounts routes under `/api/`. This part adds a provider table
in `config/providers.py` and, in the web app, one write helper (`sendJson`), two API modules
(`auth.ts`, `accounts.ts`), the account pages in `src/account/`, and the Studio shell and Team
page in `src/studio/`. Studio's pages are a table (`studio/pages.ts`) that the rail draws and the
gate checks.

**Tech Stack:** Django + allauth (headless), React 19, React Router 8, TanStack Query 5, Tailwind 4,
vitest + Testing Library, Biome.

**Spec:** `docs/superpowers/specs/2026-10-07-m4-sign-in-and-team-design.md` (M4S.1–M4S.6).

## Global Constraints

- Web commands run in Node 24 under podman, from the repository root. Below, `$WEB` stands for
  `podman run --rm --userns=keep-id -v "$PWD":/w:Z -w /w/apps/web node:24-alpine`.
- API commands need `.env` and Postgres/Redis up (`podman start code-dev-postgres code-dev-redis`).
- Words: *Sign in*, *Sign out*, *Create an account*, *Learner accounts are coming*, *Studio is for
  the team*, *Nothing in Studio for your role yet.* — exactly as the spec and boards say them.
- Errors are shown in the API's own sentence (`sentenceOf`, `ErrorNotice`), never reworded.
- No provider is named in web code except the mark lookup in `ProviderButtons.tsx` (M4S.2).
- `canActAs` exists once in the web (`api/accounts.ts`); nothing else compares roles.
- Colours only from tokens (`text-open`, `bg-btn`, …); no hex in components.
- Files stay small: one component (or one panel) per file.
- Commits: house style, one logical change each, ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A `next` that leaves the site** (`/sign-in?next=//evil.example`): sign-in must go to `/`
   instead. Pinned in Task 4 (`safeNext`).
2. **A signed-in page reload while `/api/me` fails** (API down): Studio must show the API's
   sentence, not redirect to Sign in. Pinned in Task 8.
3. **An invite that was spent between loading `/join/<token>` and submitting**: the accept call's
   410 sentence must show on the form, and no sign-up is attempted. Pinned in Task 6.
4. **Page tests whose fetch stubs never expected `/api/me`**: adding the account button must not
   change what those pages show. Checked by the whole suite in Task 7.
5. **The last operator demoting themselves**: CA0108 is shown and the switch still shows
   *Operator*. Pinned in Task 9.

---

### Task 1: Sign-in providers are a table

**Files:**
- Create: `apps/api/src/code_api/config/providers.py`
- Modify: `apps/api/src/code_api/config/auth.py` (replace `github_providers`)
- Modify: `apps/api/src/code_api/config/env.py` (`_github_in_pairs` → `_providers_in_pairs`)
- Modify: `apps/api/src/code_api/config/settings.py:6,103`
- Test: `apps/api/tests/test_allauth.py`, `apps/api/tests/test_env.py`

**Interfaces:**
- Produces: `Provider(id, client_id, secret, scope)`, `PROVIDERS`, `social_providers(env) -> dict`.

- [ ] **Step 1: Write the failing tests.** In `tests/test_allauth.py`, change the import to
  `from code_api.config.auth import mailers, social_providers` and `from code_api.config import auth`,
  rename `github_providers` to `social_providers` in the three existing tests, and add:

```python
def test_every_provider_in_the_table_is_read(monkeypatch: pytest.MonkeyPatch) -> None:
    # A second entry, on GitHub's fields for the test: the table, not the code, names providers.
    from code_api.config.providers import PROVIDERS, Provider

    orcid = Provider("orcid", "github_client_id", "github_client_secret", ("/authenticate",))
    monkeypatch.setattr(auth, "PROVIDERS", (*PROVIDERS, orcid))
    providers = social_providers(env(github_client_id="Iv1.abc", github_client_secret="s3cret"))
    assert sorted(providers) == ["github", "orcid"]
    assert providers["orcid"]["SCOPE"] == ["/authenticate"]
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `uv run pytest apps/api/tests/test_allauth.py -q`
  Expected: ImportError, `cannot import name 'social_providers'`.

- [ ] **Step 3: Write `config/providers.py`.**

```python
"""Sign-in providers, as data (M4.8a spec, M4S.2).

Adding one is an entry here and its two `Env` fields; `social_providers` and `Env`'s pair check
read this table, and the web draws a button for whatever allauth's config then lists.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    id: str  # allauth's provider id
    client_id: str  # the Env field holding the OAuth client id
    secret: str  # the Env field holding its secret
    scope: tuple[str, ...]


PROVIDERS = (
    # The profile and the verified addresses; the account takes the invite's email (M4A.2).
    Provider("github", "github_client_id", "github_client_secret", ("read:user", "user:email")),
)
```

- [ ] **Step 4: Replace `github_providers` in `config/auth.py`.**

```python
def social_providers(env: Env) -> dict[str, Any]:
    """allauth's provider table: every provider in `PROVIDERS` whose client is set (M4S.2)."""
    table: dict[str, Any] = {}
    for provider in PROVIDERS:
        client_id = getattr(env, provider.client_id)
        secret = getattr(env, provider.secret)
        if client_id is None or secret is None:
            continue
        table[provider.id] = {
            "APPS": [{"client_id": client_id, "secret": secret.get_secret_value()}],
            "SCOPE": list(provider.scope),
        }
    return table
```

  with `from code_api.config.providers import PROVIDERS` at the top. In `settings.py`, import
  `social_providers` and set `SOCIALACCOUNT_PROVIDERS = social_providers(ENV)`.

- [ ] **Step 5: Generalise `Env`'s check.** In `config/env.py`, import `PROVIDERS` and replace
  `_github_in_pairs` with:

```python
@model_validator(mode="after")
def _providers_in_pairs(self) -> Self:
    for provider in PROVIDERS:
        if (getattr(self, provider.client_id) is None) != (getattr(self, provider.secret) is None):
            first, second = provider.client_id.upper(), provider.secret.upper()
            raise ValueError(f"set both CODE_{first} and CODE_{second}, or neither")
    return self
```

- [ ] **Step 6: Run the tests.**
  Run: `uv run pytest apps/api/tests/test_allauth.py apps/api/tests/test_env.py -q`
  Expected: all pass (`test_a_github_client_needs_both_halves` still finds its sentence).

- [ ] **Step 7: Lint, types, commit.**
  Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy` — Expected: clean.

```bash
git add apps/api/src/code_api/config apps/api/tests/test_allauth.py
git commit -m "feat(api): sign-in providers are a table — M4.8a.1"
```

---

### Task 2: One way to write, with the CSRF token

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/api/client.test.ts`

**Interfaces:**
- Produces: `csrfToken(): string`; `sendJson<T>(method, url, body?, accept?) => Promise<T>`
  (resolves `undefined` for 204); `getJson` unchanged in behaviour.

- [ ] **Step 1: Write the failing tests** (append to `client.test.ts`; import `sendJson`,
  `csrfToken`; this file runs in `node`, so set `document` per test with a stub):

```ts
describe("sendJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON with the CSRF cookie's token", async () => {
    vi.stubGlobal("document", { cookie: "theme=dark; csrftoken=abc%3D1" });
    const fake = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fake);
    await expect(sendJson("POST", "/api/x", { a: 1 })).resolves.toEqual({ ok: true });
    expect(fake).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({
        method: "POST",
        body: '{"a":1}',
        headers: expect.objectContaining({ "X-CSRFToken": "abc=1" }),
      }),
    );
  });

  it("resolves nothing for a 204", async () => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    await expect(sendJson("DELETE", "/api/x")).resolves.toBeUndefined();
  });

  it("carries the API's sentence out of a refusal", async () => {
    vi.stubGlobal("document", { cookie: "" });
    answers({ detail: "Studio needs an active operator.", code: "CA0108" }, 409);
    await expect(sendJson("PATCH", "/api/team/members/x", {})).rejects.toMatchObject(
      new ApiUnreachable("Studio needs an active operator.", 409),
    );
  });

  it("returns an accepted status's body", async () => {
    vi.stubGlobal("document", { cookie: "" });
    answers({ status: 401 }, 401);
    await expect(sendJson("DELETE", "/_allauth/x", undefined, [401])).resolves.toEqual({
      status: 401,
    });
  });
});

describe("csrfToken", () => {
  it("is empty without the cookie", () => {
    vi.stubGlobal("document", { cookie: "theme=dark" });
    expect(csrfToken()).toBe("");
  });
});
```

- [ ] **Step 2: Run to see it fail.**
  Run: `$WEB npx vitest run src/api/client.test.ts`
  Expected: FAIL, `sendJson` is not exported.

- [ ] **Step 3: Implement.** In `client.ts`, move the part of `getJson` after `fetch` into
  `readAnswer` and add the two exports:

```ts
/** The status and JSON of an answer, as `getJson` and `sendJson` both read it. */
async function readAnswer<T>(response: Response, accept: readonly number[]): Promise<T> {
  const usable = response.ok || accept.includes(response.status);
  if (usable && response.status === 204) return undefined as T;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // An error page that is not JSON (nginx's 502 while the API is down) is still its status.
    throw new ApiUnreachable(
      usable ? "the response wasn't JSON" : `HTTP ${response.status}`,
      response.status,
    );
  }
  if (!usable) {
    throw new ApiUnreachable(detailOf(body) ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
}

/** Django's CSRF cookie, which every write carries back as `X-CSRFToken` (M4S.3). It is
 * readable on purpose; the session cookie is the HttpOnly one. */
export function csrfToken(): string {
  const prefix = "csrftoken=";
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return found === undefined ? "" : decodeURIComponent(found.slice(prefix.length));
}

/** Write to the API (M4S.3): JSON in, JSON out (nothing for a 204), failures worded as
 * `getJson` words them; `accept` lists statuses whose body is an answer, not a failure. */
export async function sendJson<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  accept: readonly number[] = [],
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiUnreachable("network error");
  }
  return readAnswer<T>(response, accept);
}
```

  `getJson` keeps its `fetch` call and ends with `return readAnswer<T>(response, accept);`.

- [ ] **Step 4: Run the tests.**
  Run: `$WEB npx vitest run src/api/client.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): sendJson, one way to write with the CSRF token — M4.8a.2"
```

---

### Task 3: The auth and accounts modules, and their queries

**Files:**
- Create: `apps/web/src/api/auth.ts`, `apps/web/src/api/auth.test.ts`
- Create: `apps/web/src/api/accounts.ts`, `apps/web/src/api/accounts.test.ts`
- Modify: `apps/web/src/api/queries.ts`
- Create: `apps/web/src/test-kit.tsx` (test helpers used from here on)

**Interfaces:**
- Consumes: `getJson`, `sendJson`, `csrfToken` (Task 2).
- Produces:
  - `auth.ts`: `Provider {id, name}`, `fetchProviders(signal?)`, `FormRefused {byField}`,
    `signIn(email, password)`, `signUp(email, password)`, `signOut()`,
    `requestPasswordReset(email)`, `resetPassword(key, password)`, `continueWith(provider, next)`.
  - `accounts.ts`: `ROLES`, `Role`, `ROLE_LABEL`, `canActAs(held, wanted)`, `fetchMe`,
    `fetchInvite`, `acceptInvite`, `fetchMembers`, `fetchInvites`, `sendInvite`, `withdrawInvite`,
    `changeRole`, `deactivate`.
  - `queries.ts`: keys `me`, `providers`, `invite(token)`, `teamMembers`, `teamInvites`; hooks
    `useMe`, `useProviders`, `useInvite`, `useMembers`, `useInvites`, `useAuthChange`,
    `useTeamChange`.
  - `test-kit.tsx`: `answering(answers)`, `renderAt(path, routes)`, `Where`, `SIGNED_OUT`,
    `signedInAs(role)`.

- [ ] **Step 1: Write `test-kit.tsx`.**

```tsx
// Test helpers for pages that ask the API: a fetch that answers by method and path, and a
// render inside a fresh query client and router. Unlisted questions never answer.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";
import type { MeOut } from "./api/schema";

export interface Answer {
  status?: number;
  body?: unknown;
}

export function answering(answers: Record<string, Answer | ((init?: RequestInit) => Answer)>) {
  const fake = vi.fn((url: string, init?: RequestInit) => {
    const found = answers[`${init?.method ?? "GET"} ${url}`];
    if (found === undefined) return new Promise<Response>(() => {});
    const { status = 200, body = {} } = typeof found === "function" ? found(init) : found;
    const text = status === 204 ? null : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  vi.stubGlobal("fetch", fake);
  return fake;
}

export function Where() {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{`${pathname}${search}`}</span>;
}

export const renderAt = (path: string, routes: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes}
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

export const SIGNED_OUT: Answer = { body: { user: null } satisfies MeOut };

export const signedInAs = (role: string, name = "Ada"): Answer => ({
  body: {
    user: { public_id: "u-1", email: "ada@example.org", name, role },
  } satisfies MeOut,
});
```

- [ ] **Step 2: Write the failing tests** — `auth.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { continueWith, FormRefused, fetchProviders, signIn, signOut, resetPassword } from "./auth";
import { answering } from "../test-kit";

afterEach(() => vi.unstubAllGlobals());

describe("auth", () => {
  it("lists the providers allauth reports", async () => {
    answering({
      "GET /_allauth/browser/v1/config": {
        body: { data: { socialaccount: { providers: [{ id: "github", name: "GitHub" }] } } },
      },
    });
    await expect(fetchProviders()).resolves.toEqual([{ id: "github", name: "GitHub" }]);
  });

  it("lists none when allauth reports no social accounts", async () => {
    answering({ "GET /_allauth/browser/v1/config": { body: { data: {} } } });
    await expect(fetchProviders()).resolves.toEqual([]);
  });

  it("signs in", async () => {
    const fake = answering({ "POST /_allauth/browser/v1/auth/login": { body: { status: 200 } } });
    await signIn("ada@example.org", "pw");
    expect(fake.mock.calls[0]?.[1]?.body).toBe('{"email":"ada@example.org","password":"pw"}');
  });

  it("keeps allauth's sentences by field", async () => {
    answering({
      "POST /_allauth/browser/v1/auth/login": {
        status: 400,
        body: { status: 400, errors: [{ message: "Wrong password.", param: "password" }] },
      },
    });
    const refused = await signIn("a@b.c", "x").catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(FormRefused);
    expect((refused as FormRefused).byField).toEqual({ password: ["Wrong password."] });
  });

  it("words a closed sign-up", async () => {
    answering({
      "POST /_allauth/browser/v1/auth/login": { status: 403, body: { status: 403 } },
    });
    const refused = (await signIn("a@b.c", "x").catch((e: unknown) => e)) as FormRefused;
    expect(refused.byField[""]).toEqual(["Sign-up needs an invite."]);
  });

  it("takes allauth's 401 as signed out", async () => {
    answering({ "DELETE /_allauth/browser/v1/auth/session": { status: 401, body: { status: 401 } } });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("takes a reset's 401 as done", async () => {
    answering({
      "POST /_allauth/browser/v1/auth/password/reset": { status: 401, body: { status: 401 } },
    });
    await expect(resetPassword("k", "pw")).resolves.toBeUndefined();
  });

  it("leaves for a provider through allauth's form", () => {
    document.cookie = "csrftoken=tok";
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    continueWith("github", "/studio");
    const form = document.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/_allauth/browser/v1/auth/provider/redirect");
    expect(Object.fromEntries(new FormData(form as HTMLFormElement))).toEqual({
      provider: "github",
      callback_url: "/studio",
      process: "login",
      csrfmiddlewaretoken: "tok",
    });
    expect(submit).toHaveBeenCalled();
    form?.remove();
  });
});
```

  `accounts.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering } from "../test-kit";
import { acceptInvite, canActAs, changeRole } from "./accounts";

afterEach(() => vi.unstubAllGlobals());

describe("canActAs", () => {
  it("ranks the roles as roles.py does", () => {
    expect(canActAs("operator", "reviewer")).toBe(true);
    expect(canActAs("reviewer", "operator")).toBe(false);
    expect(canActAs("author", "author")).toBe(true);
    expect(canActAs("", "author")).toBe(false);
  });
});

describe("accounts", () => {
  it("accepts an invite by its token", async () => {
    const fake = answering({
      "POST /api/invites/t%2F1/accept": { body: { email: "a@b.c", role: "author" } },
    });
    await expect(acceptInvite("t/1")).resolves.toEqual({ email: "a@b.c", role: "author" });
    expect(fake).toHaveBeenCalledOnce();
  });

  it("changes a role", async () => {
    const fake = answering({ "PATCH /api/team/members/u-2": { body: { role: "reviewer" } } });
    await changeRole("u-2", "reviewer");
    expect(fake.mock.calls[0]?.[1]?.body).toBe('{"role":"reviewer"}');
  });
});
```

- [ ] **Step 3: Run to see them fail.**
  Run: `$WEB npx vitest run src/api/auth.test.ts src/api/accounts.test.ts`
  Expected: FAIL, the modules do not exist.

- [ ] **Step 4: Write `auth.ts`.**

```ts
// allauth's headless API for the browser (M4.3 spec, M4A.3; M4.8a spec, M4S.2–M4S.3).
//
// allauth answers in its own shape, `{status, errors: [{message, param}]}`, so a refusal becomes
// a `FormRefused` holding the sentences by field, and a form shows each beside its input.
import { csrfToken, getJson, sendJson } from "./client";

const BASE = "/_allauth/browser/v1";

export interface Provider {
  id: string;
  name: string;
}

interface ConfigAnswer {
  data: { socialaccount?: { providers: Provider[] } };
}

interface AllauthAnswer {
  status: number;
  errors?: { message: string; param?: string }[];
}

/** The sign-in providers allauth has configured: one button each (M4S.2). */
export const fetchProviders = async (signal?: AbortSignal): Promise<Provider[]> =>
  (await getJson<ConfigAnswer>(`${BASE}/config`, signal)).data.socialaccount?.providers ?? [];

const WITHOUT_SENTENCE: Record<number, string> = {
  403: "Sign-up needs an invite.",
  409: "You are signed in already.",
};

/** allauth refused a form: its sentences, by the field they are about ("" for the form). */
export class FormRefused extends Error {
  readonly byField: Readonly<Record<string, string[]>>;

  constructor(byField: Record<string, string[]>) {
    super(Object.values(byField).flat().join(" "));
    this.name = "FormRefused";
    this.byField = byField;
  }

  static of(answer: AllauthAnswer): FormRefused {
    const byField: Record<string, string[]> = {};
    for (const { message, param } of answer.errors ?? []) {
      const field = param ?? "";
      byField[field] = [...(byField[field] ?? []), message];
    }
    if (Object.keys(byField).length === 0) {
      byField[""] = [WITHOUT_SENTENCE[answer.status] ?? `HTTP ${answer.status}`];
    }
    return new FormRefused(byField);
  }
}

async function post(path: string, body: unknown, done: readonly number[] = [200]) {
  const answer = await sendJson<AllauthAnswer>("POST", `${BASE}${path}`, body, [400, 401, 403, 409]);
  if (!done.includes(answer.status)) throw FormRefused.of(answer);
}

export const signIn = (email: string, password: string) =>
  post("/auth/login", { email, password });

/** Sign-up works only with an invite held in the session (M4A.2); the adapter decides. */
export const signUp = (email: string, password: string) =>
  post("/auth/signup", { email, password });

export const requestPasswordReset = (email: string) => post("/auth/password/request", { email });

// A reset that worked answers 401 here: the password is set, and nobody is signed in by it.
export const resetPassword = (key: string, password: string) =>
  post("/auth/password/reset", { key, password }, [200, 401]);

// allauth answers a sign-out with 401: nobody is signed in now.
export async function signOut(): Promise<void> {
  await sendJson("DELETE", `${BASE}/auth/session`, undefined, [401]);
}

/** Leave for `provider`'s sign-in through allauth's redirect form; it comes back to `next`. */
export function continueWith(provider: string, next: string): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${BASE}/auth/provider/redirect`;
  const fields = { provider, callback_url: next, process: "login", csrfmiddlewaretoken: csrfToken() };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
```

- [ ] **Step 5: Write `accounts.ts`.**

```ts
// The accounts API (M4.3 spec, M4A.1–M4A.4): who is signed in, invites, and the team.
import { getJson, sendJson } from "./client";
import type { InviteOut, MeOut, PendingInviteOut, TeamMemberOut } from "./schema";

/** The roles in rank order: each includes the ones before it (roles.py). */
export const ROLES = ["author", "reviewer", "operator"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  author: "Author",
  reviewer: "Reviewer",
  operator: "Operator",
};

/** Whether a member holding `held` may do what `wanted` may: the web's one copy of the rule. */
export function canActAs(held: string, wanted: Role): boolean {
  const rank = ROLES.indexOf(held as Role);
  return rank >= 0 && rank >= ROLES.indexOf(wanted);
}

const token = (value: string) => encodeURIComponent(value);

export const fetchMe = (signal?: AbortSignal) => getJson<MeOut>("/api/me", signal);

export const fetchInvite = (value: string, signal?: AbortSignal) =>
  getJson<InviteOut>(`/api/invites/${token(value)}`, signal);

/** Hold the invite in the session, so the sign-up that follows takes it (M4A.2). */
export const acceptInvite = (value: string) =>
  sendJson<InviteOut>("POST", `/api/invites/${token(value)}/accept`);

export const fetchMembers = (signal?: AbortSignal) =>
  getJson<TeamMemberOut[]>("/api/team/members", signal);

export const fetchInvites = (signal?: AbortSignal) =>
  getJson<PendingInviteOut[]>("/api/team/invites", signal);

export const sendInvite = (email: string, role: Role) =>
  sendJson<PendingInviteOut>("POST", "/api/team/invites", { email, role });

export const withdrawInvite = (publicId: string) =>
  sendJson<undefined>("DELETE", `/api/team/invites/${publicId}`);

export const changeRole = (publicId: string, role: Role) =>
  sendJson<TeamMemberOut>("PATCH", `/api/team/members/${publicId}`, { role });

export const deactivate = (publicId: string) =>
  sendJson<TeamMemberOut>("POST", `/api/team/members/${publicId}/deactivate`);
```

- [ ] **Step 6: Add the keys and hooks to `queries.ts`.** Add to `queryKeys`:

```ts
  me: ["me"] as const,
  providers: ["providers"] as const,
  invite: (token: string) => ["invite", token] as const,
  teamMembers: ["team", "members"] as const,
  teamInvites: ["team", "invites"] as const,
```

  and the hooks (import `useQueryClient` and the fetchers):

```ts
/** Who is signed in: the one answer the bar, the menu, the gate and Team read (M4S.3). */
export const useMe = () =>
  useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => fetchMe(signal), retry: false });

export const useProviders = () =>
  useQuery({
    queryKey: queryKeys.providers,
    queryFn: ({ signal }) => fetchProviders(signal),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useInvite = (token: string) =>
  useQuery({
    queryKey: queryKeys.invite(token),
    queryFn: ({ signal }) => fetchInvite(token, signal),
    retry: false,
  });

export const useMembers = () =>
  useQuery({ queryKey: queryKeys.teamMembers, queryFn: ({ signal }) => fetchMembers(signal), retry: false });

export const useInvites = () =>
  useQuery({ queryKey: queryKeys.teamInvites, queryFn: ({ signal }) => fetchInvites(signal), retry: false });

/** After signing in, up or out: ask again who is signed in. */
export function useAuthChange() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.me });
}

/** After any team change: both of the team's lists are asked again. */
export function useTeamChange() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["team"] });
}
```

- [ ] **Step 7: Run the tests, then the web checks.**
  Run: `$WEB npx vitest run src/api` — Expected: all pass.
  Run: `$WEB sh -c "npm run lint && npm run typecheck"` — Expected: clean (fix Biome's format
  with `npx biome format --write` if it only reflows lines).

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/api apps/web/src/test-kit.tsx
git commit -m "feat(web): the auth and accounts modules, and who is signed in — M4.8a.3"
```

---

### Task 4: The account pieces, and Sign in

**Files:**
- Create: `apps/web/src/layout/buttons.ts` (the two button classes)
- Create: `apps/web/src/account/AuthCard.tsx` (`AuthPage`, `AuthCard`, `FormErrors`)
- Create: `apps/web/src/account/Field.tsx`
- Create: `apps/web/src/account/ProviderButtons.tsx`
- Create: `apps/web/src/account/next.ts` (`safeNext`), `apps/web/src/account/next.test.ts`
- Create: `apps/web/src/account/SignInPage.tsx`, `apps/web/src/account/SignInPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (route `/sign-in`)

**Interfaces:**
- Consumes: `useProviders`, `useAuthChange`, `signIn`, `FormRefused`, `continueWith`.
- Produces: `PRIMARY`, `SECONDARY` (class strings); `AuthPage({children})`,
  `AuthCard({title, lead?, tag?, children})`, `FormErrors({errors})`,
  `Field({label, type?, value, onChange?, hint?, errors?, locked?, autoComplete?})`,
  `ProviderButtons({next, prepare?, rule})` with `rule: "before" | "after"`, `safeNext(raw)`.

- [ ] **Step 1: Write the failing tests.** `next.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a path on this site", () => expect(safeNext("/studio/team")).toBe("/studio/team"));
  it("refuses another site", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });
  it("does not come back to the account pages", () => expect(safeNext("/sign-in")).toBe("/"));
  it("is home without one", () => expect(safeNext(null)).toBe("/"));
});
```

  `SignInPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { SignInPage } from "./SignInPage";

afterEach(() => vi.unstubAllGlobals());

const CONFIG = {
  body: { data: { socialaccount: { providers: [{ id: "github", name: "GitHub" }] } } },
};
const page = (path = "/sign-in") =>
  renderAt(path, <Route path="/sign-in" element={<SignInPage />} />);

describe("SignInPage", () => {
  it("draws one button per provider allauth reports", async () => {
    answering({ "GET /_allauth/browser/v1/config": CONFIG, "GET /api/me": SIGNED_OUT });
    page();
    expect(await screen.findByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
  });

  it("signs in and goes where it was sent from", async () => {
    answering({
      "GET /_allauth/browser/v1/config": CONFIG,
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/login": { body: { status: 200 } },
    });
    page("/sign-in?next=%2Fstudio%2Fteam");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/team");
  });

  it("shows allauth's sentence beside its field", async () => {
    answering({
      "GET /_allauth/browser/v1/config": CONFIG,
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/login": {
        status: 400,
        body: { status: 400, errors: [{ message: "Wrong password.", param: "password" }] },
      },
    });
    page();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("links to Create an account and the reset", () => {
    answering({});
    page();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/join");
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
      "href",
      "/reset-password",
    );
  });
});
```

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/account` — Expected: FAIL, modules missing.

- [ ] **Step 3: Write the pieces.** `layout/buttons.ts`:

```ts
// The two buttons of the identity (W10): primary green, and the bordered secondary.
export const PRIMARY =
  "flex h-11 items-center justify-center rounded-control bg-btn px-[22px] text-[14.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60";
export const SECONDARY =
  "inline-flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-medium text-ink hover:border-sel disabled:text-ink-3";
```

  `account/next.ts`:

```ts
// Where to go after signing in: a path on this site, never back to an account page (Review Focus 1).
const ACCOUNT_PAGES = ["/sign-in", "/join", "/reset-password"];

export function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return ACCOUNT_PAGES.some((page) => raw === page || raw.startsWith(`${page}/`)) ? "/" : raw;
}
```

  `account/Field.tsx`:

```tsx
// One labelled input, its hint, and allauth's sentences about it (M4S.3).
import { useId } from "react";

interface FieldProps {
  label: string;
  type?: "email" | "password" | "text";
  value: string;
  onChange?: (value: string) => void;
  hint?: string;
  errors?: readonly string[];
  locked?: boolean;
  autoComplete?: string;
}

export function Field(props: FieldProps) {
  const { label, type = "text", value, onChange, hint, errors = [], locked = false } = props;
  const id = useId();
  const wrong = errors.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={locked}
        autoComplete={props.autoComplete}
        aria-invalid={wrong}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-10 rounded-control border px-3 text-[14px] outline-none focus:border-sel ${
          locked ? "bg-bg text-ink-2" : "bg-surface"
        } ${wrong ? "border-open" : "border-border-2"}`}
      />
      {hint !== undefined && <span className="text-[12.5px] text-ink-3">{hint}</span>}
      {errors.map((error) => (
        <span key={error} className="text-[12.5px] text-open">
          {error}
        </span>
      ))}
    </div>
  );
}
```

  `account/AuthCard.tsx`:

```tsx
// The page and card every account screen is drawn in, as on the L14 and L15 boards (M4S.6).
import type { ReactNode } from "react";
import { TopBar } from "../layout/TopBar";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="flex flex-wrap items-start justify-center gap-14 px-4 pt-14 pb-16">
        {children}
      </main>
    </div>
  );
}

interface CardProps {
  title: string;
  lead?: ReactNode;
  tag?: ReactNode;
  children?: ReactNode;
}

export function AuthCard({ title, lead, tag, children }: CardProps) {
  return (
    <section className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-panel border border-border bg-surface p-8">
      {tag}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        {lead !== undefined && <p className="text-[14px] leading-relaxed text-ink-2">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** The sentences about the whole form, in the colour that means "needs you". */
export function FormErrors({ errors = [] }: { errors?: readonly string[] }) {
  return errors.map((error) => (
    <p key={error} className="rounded-control bg-open-soft px-3.5 py-2.5 text-[13.5px] text-open">
      {error}
    </p>
  ));
}
```

  `account/ProviderButtons.tsx`:

```tsx
// One button per provider allauth reports; nothing here names a provider but the marks (M4S.2).
import { useState } from "react";
import { continueWith } from "../api/auth";
import { sentenceOf } from "../api/client";
import { useProviders } from "../api/queries";

const MARKS: Record<string, string> = {
  github:
    "M8 1.2a6.8 6.8 0 0 0-2.15 13.25c.34.06.46-.15.46-.33v-1.2c-1.9.41-2.3-.8-2.3-.8-.31-.79-.76-1-.76-1-.62-.42.05-.41.05-.41.68.05 1.04.7 1.04.7.61 1.04 1.6.74 1.99.57.06-.44.24-.74.43-.91-1.51-.17-3.1-.76-3.1-3.36 0-.74.27-1.35.7-1.83-.07-.17-.3-.86.07-1.8 0 0 .57-.18 1.87.7a6.5 6.5 0 0 1 3.4 0c1.3-.88 1.87-.7 1.87-.7.37.94.14 1.63.07 1.8.44.48.7 1.09.7 1.83 0 2.61-1.6 3.19-3.11 3.36.24.21.46.62.46 1.25v1.85c0 .18.12.4.47.33A6.8 6.8 0 0 0 8 1.2z",
};

function OrRule() {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

interface Props {
  next: string;
  /** Runs before leaving, such as holding an invite; a failure stays on the page. */
  prepare?: () => Promise<unknown>;
  /** Where the "or" rule goes, against the form beside the buttons. */
  rule: "before" | "after";
}

export function ProviderButtons({ next, prepare, rule }: Props) {
  const providers = useProviders().data ?? [];
  const [failed, setFailed] = useState<Error | null>(null);
  if (providers.length === 0) return null;

  async function choose(id: string) {
    try {
      await prepare?.();
      continueWith(id, next);
    } catch (error) {
      setFailed(error as Error);
    }
  }

  return (
    <>
      {rule === "before" && <OrRule />}
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void choose(provider.id)}
          className="flex h-11 items-center justify-center gap-2.5 rounded-control border border-border-2 bg-surface text-[14px] font-medium hover:border-sel"
        >
          {MARKS[provider.id] !== undefined && (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d={MARKS[provider.id]} className="fill-current" />
            </svg>
          )}
          Continue with {provider.name}
        </button>
      ))}
      {failed !== null && <p className="text-[13.5px] text-open">{sentenceOf(failed)}</p>}
      {rule === "after" && <OrRule />}
    </>
  );
}
```

- [ ] **Step 4: Write `SignInPage.tsx`.**

```tsx
// L14 · Sign in (M4.8a spec, M4S.1–M4S.2): providers first, then email and password.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FormRefused, signIn } from "../api/auth";
import { useAuthChange } from "../api/queries";
import { ErrorNotice } from "../layout/ErrorNotice";
import { PRIMARY } from "../layout/buttons";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";
import { safeNext } from "./next";
import { ProviderButtons } from "./ProviderButtons";

export function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const changed = useAuthChange();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = useMutation({
    mutationFn: () => signIn(email, password),
    onSuccess: async () => {
      await changed();
      navigate(next);
    },
  });
  const refused = submit.error instanceof FormRefused ? submit.error.byField : {};

  return (
    <AuthPage>
      <AuthCard
        title="Sign in"
        lead="to keep your routes and what you know, and to open Studio if you’re on the team."
      >
        <ProviderButtons next={next} rule="after" />
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate();
          }}
        >
          <Field label="Email" type="email" value={email} onChange={setEmail}
            errors={refused.email} autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword}
            errors={refused.password} autoComplete="current-password" />
          <Link to="/reset-password" className="-mt-2 self-end text-[13px] text-sel">
            Forgot your password?
          </Link>
          <FormErrors errors={refused[""]} />
          {submit.error !== null && !(submit.error instanceof FormRefused) && (
            <ErrorNotice error={submit.error} />
          )}
          <button type="submit" className={PRIMARY} disabled={submit.isPending}>
            Sign in
          </button>
        </form>
        <p className="text-center text-[13.5px] text-ink-2">
          New here?{" "}
          <Link to="/join" className="text-sel">
            Create an account
          </Link>
        </p>
      </AuthCard>
    </AuthPage>
  );
}
```

  (Biome formats the `Field` props one per line; run its formatter rather than hand-wrapping.)
  In `App.tsx` add `<Route path="/sign-in" element={<SignInPage />} />`.

- [ ] **Step 5: Run the tests.**
  Run: `$WEB npx vitest run src/account` — Expected: all pass.

- [ ] **Step 6: Lint, types, commit.**
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck"`.

```bash
git add apps/web/src/layout/buttons.ts apps/web/src/account apps/web/src/App.tsx
git commit -m "feat(web): Sign in, with a button per configured provider — M4.8a.4"
```

---

### Task 5: Resetting a password

**Files:**
- Create: `apps/web/src/account/ResetPassword.tsx` (`RequestResetPage`, `ResetPasswordPage`)
- Create: `apps/web/src/account/ResetPassword.test.tsx`
- Modify: `apps/web/src/App.tsx` (routes `/reset-password`, `/reset-password/:key`)

**Interfaces:**
- Consumes: `requestPasswordReset`, `resetPassword`, `FormRefused`, `AuthPage`, `AuthCard`,
  `FormErrors`, `Field`, `PRIMARY`.

- [ ] **Step 1: Write the failing tests.**

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { RequestResetPage, ResetPasswordPage } from "./ResetPassword";

afterEach(() => vi.unstubAllGlobals());

const routes = (
  <>
    <Route path="/reset-password" element={<RequestResetPage />} />
    <Route path="/reset-password/:key" element={<ResetPasswordPage />} />
  </>
);

describe("resetting a password", () => {
  it("says a link is on its way, whoever asked", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/request": { body: { status: 200 } },
    });
    renderAt("/reset-password", routes);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Send a link" }));
    expect(
      await screen.findByText("If an account has that address, a link is on its way."),
    ).toBeInTheDocument();
  });

  it("sets the new password with the link's key", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/reset": { status: 401, body: { status: 401 } },
    });
    renderAt("/reset-password/k-1", routes);
    await userEvent.type(screen.getByLabelText("New password"), "a long new password");
    await userEvent.click(screen.getByRole("button", { name: "Set the password" }));
    expect(await screen.findByText("Your password is set.")).toBeInTheDocument();
    const reset = fake.mock.calls.find(([url]) => url.endsWith("/password/reset"));
    expect(reset?.[1]?.body).toBe('{"key":"k-1","password":"a long new password"}');
  });

  it("shows why a link no longer works", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/reset": {
        status: 400,
        body: { status: 400, errors: [{ message: "The password reset token was invalid.", param: "key" }] },
      },
    });
    renderAt("/reset-password/old", routes);
    await userEvent.type(screen.getByLabelText("New password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Set the password" }));
    expect(await screen.findByText("The password reset token was invalid.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/account/ResetPassword.test.tsx` — Expected: FAIL, module missing.

- [ ] **Step 3: Implement `ResetPassword.tsx`.**

```tsx
// Resetting a password (M4S.3): ask for a link, then set the password from it. allauth mails
// nobody for an unknown address (M4.3), so the page says the same whoever asked.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { FormRefused, requestPasswordReset, resetPassword } from "../api/auth";
import { ErrorNotice } from "../layout/ErrorNotice";
import { PRIMARY, SECONDARY } from "../layout/buttons";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";

export function RequestResetPage() {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => requestPasswordReset(email) });
  const refused = send.error instanceof FormRefused ? send.error.byField : {};
  return (
    <AuthPage>
      <AuthCard title="Reset your password" lead="We’ll mail a link to set a new one.">
        {send.isSuccess ? (
          <p className="text-[14px] text-ink-2">If an account has that address, a link is on its way.</p>
        ) : (
          <form className="flex flex-col gap-[18px]" onSubmit={(event) => {
            event.preventDefault();
            send.mutate();
          }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} errors={refused.email} />
            <FormErrors errors={refused[""]} />
            {send.error !== null && !(send.error instanceof FormRefused) && <ErrorNotice error={send.error} />}
            <button type="submit" className={PRIMARY} disabled={send.isPending}>Send a link</button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}

export function ResetPasswordPage() {
  const { key = "" } = useParams();
  const [password, setPassword] = useState("");
  const set = useMutation({ mutationFn: () => resetPassword(key, password) });
  const refused = set.error instanceof FormRefused ? set.error.byField : {};
  return (
    <AuthPage>
      <AuthCard title="Set a new password">
        {set.isSuccess ? (
          <>
            <p className="text-[14px] text-ink-2">Your password is set.</p>
            <Link to="/sign-in" className={`${SECONDARY} self-start`}>Sign in</Link>
          </>
        ) : (
          <form className="flex flex-col gap-[18px]" onSubmit={(event) => {
            event.preventDefault();
            set.mutate();
          }}>
            <Field label="New password" type="password" value={password} onChange={setPassword}
              errors={refused.password} autoComplete="new-password" />
            <FormErrors errors={[...(refused.key ?? []), ...(refused[""] ?? [])]} />
            {set.error !== null && !(set.error instanceof FormRefused) && <ErrorNotice error={set.error} />}
            <button type="submit" className={PRIMARY} disabled={set.isPending}>Set the password</button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}
```

  Add both routes to `App.tsx`.

- [ ] **Step 4: Run, lint, commit.**
  Run: `$WEB npx vitest run src/account` — Expected: all pass.
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck"`.

```bash
git add apps/web/src/account apps/web/src/App.tsx
git commit -m "feat(web): resetting a password — M4.8a.5"
```

---

### Task 6: Join, *not yet*, and a provider's refusal

**Files:**
- Create: `apps/web/src/account/NotYet.tsx`
- Create: `apps/web/src/account/JoinPage.tsx`, `apps/web/src/account/JoinPage.test.tsx`
- Create: `apps/web/src/account/SignInErrorPage.tsx`, `apps/web/src/account/SignInErrorPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (routes `/join`, `/join/:token`, `/sign-in/error`)

**Interfaces:**
- Consumes: `useInvite`, `acceptInvite`, `signUp`, `ROLE_LABEL`, `ProviderButtons` (`prepare`),
  `useAuthChange`.
- Produces: `NotYet()`, `JoinPage()`, `SignInErrorPage()`.

- [ ] **Step 1: Write the failing tests.** `JoinPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { JoinPage } from "./JoinPage";

afterEach(() => vi.unstubAllGlobals());

const routes = (
  <>
    <Route path="/join" element={<JoinPage />} />
    <Route path="/join/:token" element={<JoinPage />} />
  </>
);
const INVITE = { body: { email: "new@example.org", role: "author" } };

describe("JoinPage", () => {
  it("says learner accounts are coming, without an invite", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    renderAt("/join", routes);
    expect(
      screen.getByRole("heading", { name: "Learner accounts are coming" }),
    ).toBeInTheDocument();
  });

  it("creates the account with the invite's address and lands in Studio", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/tok": INVITE,
      "POST /api/invites/tok/accept": INVITE,
      "POST /_allauth/browser/v1/auth/signup": { body: { status: 200 } },
    });
    renderAt("/join/tok", routes);
    expect(await screen.findByLabelText("Email")).toHaveValue("new@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "a long password");
    await userEvent.click(screen.getByRole("button", { name: "Create your account" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio");
    const order = fake.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(order.indexOf("POST /api/invites/tok/accept")).toBeLessThan(
      order.indexOf("POST /_allauth/browser/v1/auth/signup"),
    );
  });

  it("shows the API's sentence for a spent invite", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/old": {
        status: 410,
        body: { detail: "This invite has expired; ask for a new one.", code: "CA0104" },
      },
    });
    renderAt("/join/old", routes);
    expect(
      await screen.findByText("This invite has expired; ask for a new one."),
    ).toBeInTheDocument();
  });

  it("does not sign up when the invite was spent meanwhile", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/tok": INVITE,
      "POST /api/invites/tok/accept": {
        status: 410,
        body: { detail: "This invite has been used already.", code: "CA0106" },
      },
    });
    renderAt("/join/tok", routes);
    await userEvent.type(await screen.findByLabelText("Password"), "a long password");
    await userEvent.click(screen.getByRole("button", { name: "Create your account" }));
    expect(await screen.findByText("This invite has been used already.")).toBeInTheDocument();
    expect(fake.mock.calls.some(([url]) => url.endsWith("/auth/signup"))).toBe(false);
  });
});
```

  `SignInErrorPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { SignInErrorPage } from "./SignInErrorPage";

afterEach(() => vi.unstubAllGlobals());

const page = (query: string) =>
  renderAt(`/sign-in/error${query}`, <Route path="/sign-in/error" element={<SignInErrorPage />} />);

describe("SignInErrorPage", () => {
  it("is not yet for an account Code doesn't know", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    page("?error=signup_closed&error_process=login");
    expect(screen.getByRole("heading", { name: "Learner accounts are coming" })).toBeInTheDocument();
  });

  it("names any other reason, with a way back", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    page("?error=cancelled");
    expect(screen.getByRole("heading", { name: "Signing in didn’t finish" })).toBeInTheDocument();
    expect(screen.getByText(/cancelled/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Sign in" })).toHaveAttribute("href", "/sign-in");
  });
});
```

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/account` — Expected: FAIL, modules missing.

- [ ] **Step 3: Write `NotYet.tsx`.**

```tsx
// Every way someone without an invite tries to make an account ends here (M4S.1). When learner
// accounts open, this component is deleted.
import { Link } from "react-router";
import { SECONDARY } from "../layout/buttons";
import { AuthCard } from "./AuthCard";

export function NotYet() {
  return (
    <AuthCard
      title="Learner accounts are coming"
      tag={
        <span className="self-start rounded-pill border border-border-2 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-2">
          Not open yet
        </span>
      }
      lead="You can’t create an account yet. Everything in Comeni Code works without one: routes, pages and questions are all here."
    >
      <p className="text-[14px] leading-relaxed text-ink-2">
        On the team? Open the link in your invite email.
      </p>
      <Link to="/" className={`${SECONDARY} self-start`}>
        Back to Start
      </Link>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Write `JoinPage.tsx`.**

```tsx
// L15 · Join (M4.8a spec, M4S.1): with an invite, an account on the invite's address; without
// one, not yet. Accepting holds the invite in the session first, so sign-up can take it (M4A.2).
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { acceptInvite, ROLE_LABEL, type Role } from "../api/accounts";
import { FormRefused, signUp } from "../api/auth";
import { useAuthChange, useInvite } from "../api/queries";
import { ErrorNotice } from "../layout/ErrorNotice";
import { PRIMARY } from "../layout/buttons";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";
import { NotYet } from "./NotYet";
import { ProviderButtons } from "./ProviderButtons";

export function JoinPage() {
  const { token } = useParams();
  return <AuthPage>{token === undefined ? <NotYet /> : <Invited token={token} />}</AuthPage>;
}

function Invited({ token }: { token: string }) {
  const invite = useInvite(token);
  const navigate = useNavigate();
  const changed = useAuthChange();
  const [password, setPassword] = useState("");
  const join = useMutation({
    mutationFn: async (email: string) => {
      await acceptInvite(token);
      await signUp(email, password);
    },
    onSuccess: async () => {
      await changed();
      navigate("/studio");
    },
  });

  if (invite.isPending) return <p className="text-[15px] text-ink-2">Loading the invite…</p>;
  if (invite.isError) {
    return (
      <AuthCard title="This invite can’t be used">
        <ErrorNotice error={invite.error} />
      </AuthCard>
    );
  }
  const { email, role } = invite.data;
  const label = ROLE_LABEL[role as Role] ?? role;
  const refused = join.error instanceof FormRefused ? join.error.byField : {};

  return (
    <AuthCard
      title="Join the Studio team"
      tag={
        <span className="self-start rounded-pill bg-sel-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-sel">
          Invite · {label.toLowerCase()}
        </span>
      }
      lead={`You’re invited to Comeni Code’s Studio as ${label === "Author" ? "an" : "a"} ${label.toLowerCase()}. The invite works once.`}
    >
      <form className="flex flex-col gap-[18px]" onSubmit={(event) => {
        event.preventDefault();
        join.mutate(email);
      }}>
        <Field label="Email" type="email" value={email} locked hint="The address the invite was sent to." />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          errors={refused.password} autoComplete="new-password" />
        <FormErrors errors={refused[""]} />
        {join.error !== null && !(join.error instanceof FormRefused) && <ErrorNotice error={join.error} />}
        <button type="submit" className={PRIMARY} disabled={join.isPending}>Create your account</button>
      </form>
      <ProviderButtons next="/studio" prepare={() => acceptInvite(token)} rule="before" />
      <p className="text-[12.5px] text-ink-3">With a provider, your account still takes the invite’s address.</p>
    </AuthCard>
  );
}
```

  (The board's line naming who invited you and the expiry date needs fields `InviteOut` does not
  have; the lead says what the API knows. Recorded as a ruling.)

- [ ] **Step 5: Write `SignInErrorPage.tsx`.**

```tsx
// /sign-in/error, where allauth sends a provider sign-in it stopped (M4A.3). An account Code
// doesn't know is the same "not yet" as /join (M4S.1); anything else is named.
import { Link, useSearchParams } from "react-router";
import { SECONDARY } from "../layout/buttons";
import { AuthCard, AuthPage } from "./AuthCard";
import { NotYet } from "./NotYet";

export function SignInErrorPage() {
  const [params] = useSearchParams();
  const reason = params.get("error") ?? "no reason given";
  return (
    <AuthPage>
      {reason === "signup_closed" ? (
        <NotYet />
      ) : (
        <AuthCard
          title="Signing in didn’t finish"
          lead={`The provider’s sign-in stopped (${reason}). Try again, or use your email and password.`}
        >
          <Link to="/sign-in" className={`${SECONDARY} self-start`}>
            Back to Sign in
          </Link>
        </AuthCard>
      )}
    </AuthPage>
  );
}
```

  Add the three routes to `App.tsx`.

- [ ] **Step 6: Run, lint, commit.**
  Run: `$WEB npx vitest run src/account` — Expected: all pass.
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck"`.

```bash
git add apps/web/src/account apps/web/src/App.tsx
git commit -m "feat(web): Join through an invite, and an honest not-yet — M4.8a.6"
```

- [ ] **Step 7: Checkpoint review.** Dispatch a fresh reviewer (opus) on
  `git diff main...HEAD` with this plan and the spec; file its findings as one issue
  (*M4.8a checkpoint review — findings*), fix Critical and Important test-first, and ledger the
  rest.

---

### Task 7: The account button and menu

**Files:**
- Create: `apps/web/src/layout/Mark.tsx` (the logo, moved out of `TopBar.tsx`)
- Create: `apps/web/src/layout/AccountButton.tsx`, `apps/web/src/layout/AccountMenu.tsx`
- Create: `apps/web/src/layout/AccountButton.test.tsx`
- Modify: `apps/web/src/layout/TopBar.tsx`, `apps/web/src/layout/TopBar.test.tsx`
- Modify (only if the suite says so): page tests whose stubs never answered `/api/me`

**Interfaces:**
- Consumes: `useMe`, `useAuthChange`, `signOut`, `SECONDARY`.
- Produces: `Mark({ studio? })`, `AccountButton()`, `AccountMenu({ user, onClose })`.

- [ ] **Step 1: Write the failing tests.** `AccountButton.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT, signedInAs } from "../test-kit";
import { AccountButton } from "./AccountButton";

afterEach(() => vi.unstubAllGlobals());

const at = (path = "/route") => renderAt(path, <Route path="/route" element={<AccountButton />} />);

describe("AccountButton", () => {
  it("offers Sign in when signed out, coming back here", async () => {
    answering({ "GET /api/me": SIGNED_OUT });
    at();
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Froute",
    );
  });

  it("opens Studio for a member with a role", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    expect(screen.getByText("ada@example.org")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open Studio" })).toHaveAttribute("href", "/studio");
  });

  it("does not offer Studio without a role", async () => {
    answering({ "GET /api/me": signedInAs("") });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    expect(screen.queryByRole("menuitem", { name: "Open Studio" })).toBeNull();
  });

  it("signs out, and offers Sign in again", async () => {
    let signedIn = true;
    answering({
      "GET /api/me": () => (signedIn ? signedInAs("author") : SIGNED_OUT),
      "DELETE /_allauth/browser/v1/auth/session": () => {
        signedIn = false;
        return { status: 401, body: { status: 401 } };
      },
    });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
```

  In `TopBar.test.tsx`, render inside a `QueryClientProvider` (as `App.test.tsx` does), stub
  `fetch` with `answering({ "GET /api/me": SIGNED_OUT })` in a `beforeEach`, and add:

```tsx
  it("shows the account cell beside what a page puts there", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TopBar>
            <span>theme</span>
          </TopBar>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("theme")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/layout` — Expected: FAIL, `AccountButton` missing.

- [ ] **Step 3: Move the logo into `Mark.tsx`** (the `<Link to="/">…</Link>` block of `TopBar`,
  unchanged), with one addition for Studio:

```tsx
// The transit-line mark and the name; Studio's bar adds its dark tag (the Studio boards).
import { Link } from "react-router";

export function Mark({ studio = false }: { studio?: boolean }) {
  return (
    <Link to={studio ? "/studio" : "/"} className="flex shrink-0 items-center gap-2.5">
      {/* …the svg and "Comeni Code" span, moved unchanged from TopBar… */}
      {studio && (
        <span className="rounded-[6px] bg-ink px-2.5 py-0.5 text-[12px] font-semibold text-bg">
          Studio
        </span>
      )}
    </Link>
  );
}
```

  `TopBar` renders `<Mark />` in place of the block, and its last cell becomes:

```tsx
      <div className="flex items-center justify-end gap-3">
        {children}
        <AccountButton />
      </div>
```

  Update the file's header comment: the account cell is M4.8a's (M4S.1).

- [ ] **Step 4: Write `AccountButton.tsx` and `AccountMenu.tsx`.**

```tsx
// The top bar's account cell (M4S.1): Sign in when signed out, else the avatar and its menu.
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useMe } from "../api/queries";
import { AccountMenu } from "./AccountMenu";
import { SECONDARY } from "./buttons";

export function AccountButton() {
  const me = useMe();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  if (me.isPending) return null;
  // A failed or odd answer is treated as signed out: the bar never blocks a learner's page.
  const user = me.data?.user ?? null;
  if (user === null) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return (
      <Link to={`/sign-in?next=${next}`} className={SECONDARY}>
        Sign in
      </Link>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pr-2 pl-1 text-ink-2"
      >
        <span className="flex size-[26px] items-center justify-center rounded-full bg-sel-soft text-sel">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="6" r="3" className="fill-none stroke-current" strokeWidth={1.6} />
            <path d="M2.5 14c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4" className="fill-none stroke-current" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" className="fill-none stroke-current" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
      {open && <AccountMenu user={user} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

```tsx
// The account menu of the AccountMenu board, trimmed to what exists (M4S.1): who you are, Open
// Studio for the team, Sign out. Knowledge, routes, problems and theme arrive with their phases.
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { signOut } from "../api/auth";
import { useAuthChange } from "../api/queries";
import type { MemberOut } from "../api/schema";

const ITEM = "flex rounded-[8px] px-3.5 py-2.5 text-left text-[14px] hover:bg-bg";

export function AccountMenu({ user, onClose }: { user: MemberOut; onClose: () => void }) {
  const navigate = useNavigate();
  const changed = useAuthChange();
  const out = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      onClose();
      await changed();
      navigate("/");
    },
  });
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-10 mt-2 flex w-72 flex-col rounded-panel border border-border bg-surface p-2 shadow-[var(--float)]"
    >
      <div className="flex flex-col gap-0.5 border-b border-border px-3.5 pt-2.5 pb-3">
        <span className="text-[14px] font-semibold">{user.name || user.email}</span>
        <span className="text-[12.5px] text-ink-3">{user.email}</span>
      </div>
      {user.role !== "" && (
        <Link role="menuitem" to="/studio" onClick={onClose} className={ITEM}>
          Open Studio
        </Link>
      )}
      <button role="menuitem" type="button" onClick={() => out.mutate()} className={ITEM}>
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run the layout tests, then the whole web suite.**
  Run: `$WEB npx vitest run src/layout` — Expected: all pass.
  Run: `$WEB npm test` — Expected: all pass. A page test that now fails because its `fetch`
  stub answers `/api/me` with a page's body or counts calls: give that stub an `/api/me` answer
  (`SIGNED_OUT`), never change what the test asserts about the page; ledger each as a ruling.

- [ ] **Step 6: Lint, types, commit.**
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck"`.

```bash
git add apps/web/src
git commit -m "feat(web): the account button and menu in the top bar — M4.8a.7"
```

---

### Task 8: The Studio shell and its gate

**Files:**
- Create: `apps/web/src/studio/pages.ts`, `apps/web/src/studio/pages.test.ts`
- Create: `apps/web/src/studio/StudioShell.tsx`, `apps/web/src/studio/StudioBar.tsx`,
  `apps/web/src/studio/Rail.tsx`, `apps/web/src/studio/StudioHome.tsx`
- Create: `apps/web/src/studio/StudioShell.test.tsx`
- Modify: `apps/web/src/App.tsx` (the `/studio` routes)

**Interfaces:**
- Consumes: `useMe`, `canActAs`, `Role`, `Mark`, `AccountButton`, `ErrorNotice`, `SECONDARY`.
- Produces: `StudioPage {path, label, icon, minRole, place}`, `STUDIO_PAGES`,
  `pageAt(pathname)`, `pagesFor(role)`; `StudioShell` (renders `<Outlet />` behind the gate);
  `StudioHome`.

- [ ] **Step 1: Write the failing tests.** `pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pageAt, pagesFor } from "./pages";

describe("Studio's pages", () => {
  it("finds the page a path is on", () => {
    expect(pageAt("/studio/team")?.label).toBe("Team");
    expect(pageAt("/studio")).toBeUndefined();
  });

  it("gives each role the pages it can open", () => {
    expect(pagesFor("operator").map((page) => page.label)).toEqual(["Team"]);
    expect(pagesFor("author")).toEqual([]);
    expect(pagesFor("")).toEqual([]);
  });
});
```

  `StudioShell.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT, signedInAs } from "../test-kit";
import { StudioHome } from "./StudioHome";
import { StudioShell } from "./StudioShell";

afterEach(() => vi.unstubAllGlobals());

const studio = (path: string) =>
  renderAt(
    path,
    <Route path="/studio" element={<StudioShell />}>
      <Route index element={<StudioHome />} />
      <Route path="team" element={<h1>Team page</h1>} />
    </Route>,
  );

describe("StudioShell", () => {
  it("sends the signed-out to Sign in, coming back here", async () => {
    answering({ "GET /api/me": SIGNED_OUT });
    studio("/studio/team");
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/sign-in?next=%2Fstudio%2Fteam",
    );
  });

  it("tells a member without a role that Studio is for the team", async () => {
    answering({ "GET /api/me": signedInAs("") });
    studio("/studio");
    expect(await screen.findByRole("heading", { name: "Studio is for the team" })).toBeInTheDocument();
  });

  it("names the role a page needs", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio/team");
    expect(await screen.findByText("This page needs the operator role.")).toBeInTheDocument();
    expect(screen.queryByText("Team page")).toBeNull();
  });

  it("shows the page to a member who can open it, with its rail entry", async () => {
    answering({ "GET /api/me": signedInAs("operator") });
    studio("/studio/team");
    expect(await screen.findByText("Team page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the first page a member can open", async () => {
    answering({ "GET /api/me": signedInAs("operator") });
    studio("/studio");
    expect(await screen.findByText("Team page")).toBeInTheDocument();
  });

  it("says when there is nothing for a role yet", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio");
    expect(await screen.findByText("Nothing in Studio for your role yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team" })).toBeNull();
  });

  it("shows the API's sentence when it cannot say who you are", async () => {
    answering({ "GET /api/me": { status: 503, body: { detail: "The database is down." } } });
    studio("/studio/team");
    expect(await screen.findByText("The database is down.")).toBeInTheDocument();
    expect(screen.queryByTestId("where")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/studio` — Expected: FAIL, modules missing.

- [ ] **Step 3: Write `pages.ts`.**

```ts
// Studio's pages, as data (M4S.4): the rail draws the ones a role can open, and the shell's gate
// checks the same entry, so a page is added here and nowhere else. M4.8b adds the drafts.
import { canActAs, type Role } from "../api/accounts";

export interface StudioPage {
  path: string;
  label: string;
  /** The rail icon's path, on the boards' 16×16 grid. */
  icon: string;
  minRole: Role;
  /** The rail's top groups, or its foot (AI, Library, Team on the boards). */
  place: "top" | "foot";
}

export const STUDIO_PAGES: readonly StudioPage[] = [
  {
    path: "/studio/team",
    label: "Team",
    icon: "M6 7a2.3 2.3 0 1 0 0-.01M1.8 13.5c.6-2.3 2.2-3.5 4.2-3.5s3.6 1.2 4.2 3.5M11 6.5a2 2 0 1 0 0-.01M11.5 9.8c1.4.2 2.4 1.3 2.8 3.2",
    minRole: "operator",
    place: "foot",
  },
];

export const pageAt = (pathname: string): StudioPage | undefined =>
  STUDIO_PAGES.find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`));

export const pagesFor = (role: string): StudioPage[] =>
  STUDIO_PAGES.filter((page) => canActAs(role, page.minRole));
```

- [ ] **Step 4: Write the shell.** `StudioBar.tsx`:

```tsx
// Studio's top bar, as on the S-boards: the mark with its tag, search (drawn, not yet working),
// Back to Learn, and the account cell.
import { Link } from "react-router";
import { AccountButton } from "../layout/AccountButton";
import { Mark } from "../layout/Mark";
import { SECONDARY } from "../layout/buttons";

export function StudioBar() {
  return (
    <header className="flex h-15 shrink-0 items-center justify-between gap-6 border-b border-border px-6">
      <Mark studio />
      <div
        aria-hidden="true"
        className="hidden h-9 w-[420px] items-center gap-2.5 rounded-control border border-border-2 bg-surface px-3.5 text-[13.5px] text-ink-3 md:flex"
      >
        Find a node, request or track
      </div>
      <div className="flex items-center gap-3">
        <Link to="/" className={SECONDARY}>
          Back to Learn
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
```

  `Rail.tsx`:

```tsx
// The rail (M4S.4): the pages a role can open, from STUDIO_PAGES; on a phone it is a row.
import { NavLink } from "react-router";
import { pagesFor, type StudioPage } from "./pages";

function Item({ page }: { page: StudioPage }) {
  return (
    <NavLink
      to={page.path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-[8px] border px-2.5 py-[7px] text-[14px] ${
          isActive ? "border-border bg-surface font-semibold text-ink" : "border-transparent text-ink-2"
        }`
      }
    >
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
        <path d={page.icon} className="fill-none stroke-current" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {page.label}
    </NavLink>
  );
}

export function Rail({ role }: { role: string }) {
  const pages = pagesFor(role);
  const top = pages.filter((page) => page.place === "top");
  const foot = pages.filter((page) => page.place === "foot");
  return (
    <nav aria-label="Studio" className="flex shrink-0 flex-row flex-wrap gap-0.5 border-border p-3.5 md:w-[210px] md:flex-col md:border-r">
      {top.map((page) => <Item key={page.path} page={page} />)}
      <div className="flex flex-row gap-0.5 md:mt-auto md:flex-col">
        {foot.map((page) => <Item key={page.path} page={page} />)}
      </div>
    </nav>
  );
}
```

  `StudioShell.tsx`:

```tsx
// The Studio shell (M4.8a spec, M4S.4): the boards' bar and rail, and one gate for every page.
// The API checks every route itself (M4A.4); the gate only decides what the screen shows.
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { canActAs } from "../api/accounts";
import { useMe } from "../api/queries";
import { ErrorNotice } from "../layout/ErrorNotice";
import { pageAt } from "./pages";
import { Rail } from "./Rail";
import { StudioBar } from "./StudioBar";

function Refused({ needs }: { needs: string | null }) {
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Studio is for the team</h1>
      <p className="text-[15px] text-ink-2">
        {needs === null ? "Your account has no Studio role." : `This page needs the ${needs} role.`}
      </p>
    </div>
  );
}

export function StudioShell() {
  const me = useMe();
  const { pathname, search } = useLocation();
  let inside: ReactNode = null;
  let role: string | null = null;
  if (me.isError) {
    inside = <ErrorNotice error={me.error} />;
  } else if (me.isSuccess) {
    const user = me.data.user;
    const page = pageAt(pathname);
    if (user === null) {
      inside = <Navigate to={`/sign-in?next=${encodeURIComponent(`${pathname}${search}`)}`} replace />;
    } else if (!canActAs(user.role, "author")) {
      inside = <Refused needs={null} />;
    } else if (page !== undefined && !canActAs(user.role, page.minRole)) {
      role = user.role;
      inside = <Refused needs={page.minRole} />;
    } else {
      role = user.role;
      inside = <Outlet />;
    }
  }
  return (
    <div className="flex min-h-screen flex-col">
      <StudioBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {role !== null && <Rail role={role} />}
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-[26px] py-[22px]">{inside}</main>
      </div>
    </div>
  );
}
```

  `StudioHome.tsx`:

```tsx
// /studio: the first page the member's role can open (M4S.4); none yet for an author.
import { Navigate } from "react-router";
import { useMe } from "../api/queries";
import { pagesFor } from "./pages";

export function StudioHome() {
  const first = pagesFor(useMe().data?.user?.role ?? "")[0];
  if (first !== undefined) return <Navigate to={first.path} replace />;
  return <p className="text-[15px] text-ink-2">Nothing in Studio for your role yet.</p>;
}
```

  In `App.tsx`:

```tsx
      <Route path="/studio" element={<StudioShell />}>
        <Route index element={<StudioHome />} />
        <Route path="*" element={<p className="text-[15px] text-ink-2">Nothing lives here.</p>} />
      </Route>
```

  (Task 9 adds `team`.)

- [ ] **Step 5: Run, lint, commit.**
  Run: `$WEB npx vitest run src/studio` — Expected: all pass (the test's own `team` route
  stands in for the page).
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck"`.

```bash
git add apps/web/src/studio apps/web/src/App.tsx
git commit -m "feat(web): the Studio shell, one gate and a rail from a table — M4.8a.8"
```

---

### Task 9: Team (S14)

**Files:**
- Create: `apps/web/src/studio/team/TeamPage.tsx`, `RoleSwitch.tsx`, `InviteForm.tsx`,
  `MembersPanel.tsx`, `InvitesPanel.tsx`, `TeamPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (route `team`)

**Interfaces:**
- Consumes: `useMe`, `useMembers`, `useInvites`, `useTeamChange`, `sendInvite`, `changeRole`,
  `deactivate`, `withdrawInvite`, `ROLES`, `ROLE_LABEL`, `Role`, `Field`, `PRIMARY`, `SECONDARY`,
  `ErrorNotice`.
- Produces: `TeamPage()`, `RoleSwitch({label, value, onChange, disabled?})`.

- [ ] **Step 1: Write the failing tests.**

```tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { TeamPage } from "./TeamPage";

afterEach(() => vi.unstubAllGlobals());

const ME = signedInAs("operator", "Ada");
const MEMBERS = {
  body: [
    { public_id: "u-1", email: "ada@example.org", name: "Ada", role: "operator", active: true },
    { public_id: "u-2", email: "bo@example.org", name: "Bo", role: "author", active: true },
  ],
};
const INVITES = {
  body: [
    { public_id: "i-1", email: "cy@example.org", role: "reviewer", expires_at: "2026-10-14T10:00:00Z" },
  ],
};
const team = (extra = {}) => {
  const fake = answering({
    "GET /api/me": ME,
    "GET /api/team/members": MEMBERS,
    "GET /api/team/invites": INVITES,
    ...extra,
  });
  renderAt("/studio/team", <Route path="/studio/team" element={<TeamPage />} />);
  return fake;
};
const sent = (fake: ReturnType<typeof answering>, key: string) =>
  fake.mock.calls.find(([url, init]) => `${init?.method ?? "GET"} ${url}` === key);

describe("TeamPage", () => {
  it("lists the members and the pending invites", async () => {
    team();
    expect(await screen.findByText("bo@example.org")).toBeInTheDocument();
    expect(await screen.findByText("cy@example.org")).toBeInTheDocument();
    expect(screen.getByText("Expires 2026-10-14")).toBeInTheDocument();
  });

  it("marks your own row and gives it no actions", async () => {
    team();
    const you = (await screen.findByText("ada@example.org")).closest("tr") as HTMLElement;
    expect(within(you).getByText("you")).toBeInTheDocument();
    expect(within(you).queryByRole("button", { name: /Deactivate/ })).toBeNull();
  });

  it("invites someone by email and role", async () => {
    const fake = team({ "POST /api/team/invites": { status: 201, body: INVITES.body[0] } });
    await userEvent.type(await screen.findByLabelText("Email"), "dee@example.org");
    const roles = screen.getByRole("radiogroup", { name: "Role for the invite" });
    await userEvent.click(within(roles).getByRole("radio", { name: "Reviewer" }));
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(sent(fake, "POST /api/team/invites")?.[1]?.body).toBe(
      '{"email":"dee@example.org","role":"reviewer"}',
    );
  });

  it("shows why an invite was refused", async () => {
    team({
      "POST /api/team/invites": {
        status: 409,
        body: { detail: "bo@example.org is already a member; change their role instead.", code: "CA0107" },
      },
    });
    await userEvent.type(await screen.findByLabelText("Email"), "bo@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(
      await screen.findByText("bo@example.org is already a member; change their role instead."),
    ).toBeInTheDocument();
  });

  it("changes a member's role", async () => {
    const fake = team({ "PATCH /api/team/members/u-2": { body: { ...MEMBERS.body[1], role: "reviewer" } } });
    const bo = (await screen.findByText("bo@example.org")).closest("tr") as HTMLElement;
    await userEvent.click(within(bo).getByRole("radio", { name: "Reviewer" }));
    expect(sent(fake, "PATCH /api/team/members/u-2")?.[1]?.body).toBe('{"role":"reviewer"}');
  });

  it("shows the last-operator refusal and keeps the stored role", async () => {
    team({
      "PATCH /api/team/members/u-1": {
        status: 409,
        body: { detail: "Studio needs an active operator; make someone else an operator first.", code: "CA0108" },
      },
    });
    const you = (await screen.findByText("ada@example.org")).closest("tr") as HTMLElement;
    await userEvent.click(within(you).getByRole("radio", { name: "Author" }));
    expect(
      await screen.findByText("Studio needs an active operator; make someone else an operator first."),
    ).toBeInTheDocument();
    expect(within(you).getByRole("radio", { name: "Operator" })).toHaveAttribute("aria-checked", "true");
  });

  it("deactivates only after confirming in the row", async () => {
    const fake = team({ "POST /api/team/members/u-2/deactivate": { body: { ...MEMBERS.body[1], active: false } } });
    const bo = (await screen.findByText("bo@example.org")).closest("tr") as HTMLElement;
    await userEvent.click(within(bo).getByRole("button", { name: "Deactivate" }));
    expect(sent(fake, "POST /api/team/members/u-2/deactivate")).toBeUndefined();
    await userEvent.click(within(bo).getByRole("button", { name: "Confirm" }));
    expect(sent(fake, "POST /api/team/members/u-2/deactivate")).toBeDefined();
  });

  it("withdraws a pending invite", async () => {
    const fake = team({ "DELETE /api/team/invites/i-1": { status: 204 } });
    const cy = (await screen.findByText("cy@example.org")).closest("tr") as HTMLElement;
    await userEvent.click(within(cy).getByRole("button", { name: "Withdraw" }));
    expect(sent(fake, "DELETE /api/team/invites/i-1")).toBeDefined();
  });
});
```

  The own-row role switch stays enabled so the last-operator refusal (Review Focus 5) can be
  reached; the API is what refuses.

- [ ] **Step 2: Run to see them fail.**
  Run: `$WEB npx vitest run src/studio/team` — Expected: FAIL, modules missing.

- [ ] **Step 3: Write the components.** `RoleSwitch.tsx`:

```tsx
// The Author · Reviewer · Operator switch of the S14 board, as a radio group.
import { ROLE_LABEL, ROLES, type Role } from "../../api/accounts";

interface Props {
  label: string;
  value: string;
  onChange: (role: Role) => void;
  disabled?: boolean;
}

export function RoleSwitch({ label, value, onChange, disabled = false }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex self-start rounded-control border border-border bg-bg p-[3px]">
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          disabled={disabled}
          onClick={() => onChange(role)}
          className={`rounded-[7px] px-3 py-1 text-[12.5px] ${
            value === role ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
          }`}
        >
          {ROLE_LABEL[role]}
        </button>
      ))}
    </div>
  );
}
```

  `InviteForm.tsx`:

```tsx
// Invite someone (S14): an address and a role; the API mails a one-use link for 7 days.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { type Role, sendInvite } from "../../api/accounts";
import { useTeamChange } from "../../api/queries";
import { Field } from "../../account/Field";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { PRIMARY } from "../../layout/buttons";
import { RoleSwitch } from "./RoleSwitch";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");
  const changed = useTeamChange();
  const send = useMutation({
    mutationFn: () => sendInvite(email, role),
    onSuccess: async () => {
      setEmail("");
      await changed();
    },
  });
  return (
    <form
      className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface px-5 py-[18px]"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <h2 className="text-[14.5px] font-semibold">Invite someone</h2>
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Role</span>
          <RoleSwitch label="Role for the invite" value={role} onChange={setRole} />
        </div>
        <button type="submit" className={PRIMARY} disabled={send.isPending}>
          Send invite
        </button>
      </div>
      {send.error !== null && <ErrorNotice error={send.error} />}
      <p className="text-[12.5px] text-ink-3">
        They get a link that works once, for 7 days. Authors write; reviewers also approve;
        operators also land and manage the team.
      </p>
    </form>
  );
}
```

  `MembersPanel.tsx`:

```tsx
// Members (S14): a role switch per member, and deactivating after one confirmation in the row
// (M4S.5). A refusal (CA0108) shows above the table; the switch keeps showing the stored role.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { changeRole, deactivate, type Role } from "../../api/accounts";
import { useMembers, useTeamChange } from "../../api/queries";
import type { TeamMemberOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { SECONDARY } from "../../layout/buttons";
import { RoleSwitch } from "./RoleSwitch";

const CELL = "px-[18px] py-3 text-left text-[13.5px]";
const HEAD = "px-[18px] py-2 text-left text-[12px] font-medium text-ink-3";

export function MembersPanel({ you }: { you: string | undefined }) {
  const members = useMembers();
  const changed = useTeamChange();
  const [confirming, setConfirming] = useState<string | null>(null);
  const role = useMutation({
    mutationFn: ({ id, to }: { id: string; to: Role }) => changeRole(id, to),
    onSettled: changed,
  });
  const off = useMutation({
    mutationFn: (id: string) => deactivate(id),
    onSettled: async () => {
      setConfirming(null);
      await changed();
    },
  });
  const refusal = role.error ?? off.error;

  function actions(member: TeamMemberOut) {
    if (member.public_id === you) return <span className="text-ink-3">you</span>;
    if (!member.active) return null;
    if (confirming !== member.public_id) {
      return (
        <button type="button" className={SECONDARY} onClick={() => setConfirming(member.public_id)}>
          Deactivate
        </button>
      );
    }
    return (
      <span className="flex items-center gap-2">
        <span className="text-[13px]">Deactivate {member.name || member.email}?</span>
        <button type="button" className={SECONDARY} onClick={() => off.mutate(member.public_id)}>
          Confirm
        </button>
        <button type="button" className={SECONDARY} onClick={() => setConfirming(null)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {refusal !== null && <ErrorNotice error={refusal} />}
      <div className="overflow-x-auto rounded-panel border border-border bg-surface">
        <div className="flex justify-between px-[18px] py-3.5">
          <h2 className="text-[14.5px] font-semibold">Members</h2>
          <span className="text-[12.5px] text-ink-3">{members.data?.length ?? ""}</span>
        </div>
        {members.isError && <ErrorNotice error={members.error} />}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-border">
              <th className={HEAD}>Name</th>
              <th className={HEAD}>Email</th>
              <th className={HEAD}>Role</th>
              <th className={HEAD}>Status</th>
              <th className={HEAD}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).map((member) => (
              <tr key={member.public_id} className="border-t border-border">
                <td className={`${CELL} font-medium`}>{member.name}</td>
                <td className={`${CELL} text-ink-2`}>{member.email}</td>
                <td className={CELL}>
                  <RoleSwitch
                    label={`Role for ${member.email}`}
                    value={member.role}
                    onChange={(to) => role.mutate({ id: member.public_id, to })}
                    disabled={role.isPending}
                  />
                </td>
                <td className={CELL}>
                  {member.active ? (
                    <span className="rounded-pill bg-line-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-btn">Active</span>
                  ) : (
                    <span className="rounded-pill border border-border-2 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-2">Deactivated</span>
                  )}
                </td>
                <td className={CELL}>{actions(member)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

  `InvitesPanel.tsx`:

```tsx
// Pending invites (S14): who, as what, until when, and Withdraw.
import { useMutation } from "@tanstack/react-query";
import { ROLE_LABEL, type Role, withdrawInvite } from "../../api/accounts";
import { useInvites, useTeamChange } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { SECONDARY } from "../../layout/buttons";

const CELL = "px-[18px] py-3 text-left text-[13.5px]";

export function InvitesPanel() {
  const invites = useInvites();
  const changed = useTeamChange();
  const withdraw = useMutation({ mutationFn: withdrawInvite, onSettled: changed });
  const pending = invites.data ?? [];
  return (
    <section className="flex flex-col gap-3">
      {withdraw.error !== null && <ErrorNotice error={withdraw.error} />}
      <div className="overflow-x-auto rounded-panel border border-border bg-surface">
        <div className="flex justify-between px-[18px] py-3.5">
          <h2 className="text-[14.5px] font-semibold">Pending invites</h2>
          <span className="text-[12.5px] text-ink-3">{invites.data?.length ?? ""}</span>
        </div>
        {invites.isError && <ErrorNotice error={invites.error} />}
        {pending.length > 0 && (
          <table className="w-full border-collapse">
            <tbody>
              {pending.map((invite) => (
                <tr key={invite.public_id} className="border-t border-border">
                  <td className={CELL}>{invite.email}</td>
                  <td className={`${CELL} text-ink-2`}>{ROLE_LABEL[invite.role as Role] ?? invite.role}</td>
                  <td className={`${CELL} text-ink-2`}>Expires {invite.expires_at.slice(0, 10)}</td>
                  <td className={CELL}>
                    <button type="button" className={SECONDARY} onClick={() => withdraw.mutate(invite.public_id)}>
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

  `TeamPage.tsx`:

```tsx
// S14 · Team (M4.8a spec, M4S.5): invite, the members, and the pending invites. Operators only;
// the shell's gate and the API's studio(OPERATOR) both say so.
import { useMe } from "../../api/queries";
import { InviteForm } from "./InviteForm";
import { InvitesPanel } from "./InvitesPanel";
import { MembersPanel } from "./MembersPanel";

export function TeamPage() {
  const you = useMe().data?.user?.public_id;
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Team</h1>
        <p className="text-[13.5px] text-ink-2">
          Who writes, reviews and lands content. Only operators see this page.
        </p>
      </header>
      <InviteForm />
      <MembersPanel you={you} />
      <InvitesPanel />
    </>
  );
}
```

  In `App.tsx`, inside the `/studio` route: `<Route path="team" element={<TeamPage />} />`.

- [ ] **Step 4: Run, lint, commit.**
  Run: `$WEB npx vitest run src/studio` — Expected: all pass.
  Run: `$WEB sh -c "npx biome format --write src && npm run lint && npm run typecheck && npm test && npm run build"`
  — Expected: clean, all pass, build succeeds.

```bash
git add apps/web/src/studio apps/web/src/App.tsx
git commit -m "feat(web): Team — invites, roles and deactivating — M4.8a.9"
```

---

### Task 10: In the browser, docs, and the pull request

**Files:**
- Modify: `CLAUDE.md` (the layout line for `apps/web/`: `account/`, `studio/`)
- Modify: `docs/superpowers/specs/2026-10-07-m4-sign-in-and-team-design.md` (Notes from the build)
- Create: `docs/notes/journal/2026-10-07-m4-8a-sign-in-and-team.md`
- Modify: this plan (ticks)

- [ ] **Step 1: The whole suite with CI's environment.**
  Run (from the root, with CI's variables as in `now.md`): `uv run pytest -q`,
  `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, and
  `$WEB sh -c "npm run lint && npm run typecheck && npm test && npm run build"`.
  Expected: all green.

- [ ] **Step 2: Walk *done when* in Chrome**, with `runserver`, a worker and `npm run dev`
  running (`npm run dev` under podman with `--network host`), beside the L14, L15 and S14
  boards (served from `.design/` on localhost), at 1440 in light and dark:
  1. Signed out: *Sign in* in the bar; *Create an account* → *Learner accounts are coming*.
  2. `uv run python apps/api/manage.py invite_operator <address>`; open the printed link, create
     the operator's account; Studio → Team; invite an author.
  3. Open the author's link from the runserver console; create the account; land in Studio with
     *Nothing in Studio for your role yet.*
  4. As the operator: the author is listed; change their role; withdraw a second invite; try to
     demote yourself and read CA0108.
  5. Sign out: the bar shows *Sign in*; `/studio/team` sends you to Sign in.
  Every difference from a board is fixed or recorded in the spec's notes, with why.

- [ ] **Step 3: Docs.** Update `CLAUDE.md`'s `apps/web/` layout entry with
  `account/ (sign in, join, reset, not-yet, the account menu's pieces)` and
  `studio/ (the shell, its gate and rail from pages.ts, team/)`; add *Notes from the build* to the
  spec (each ruling and board difference); write the journal entry (where things stand, what
  changed with hashes, decisions, what is next: M4.8b). Run `uv run pytest tests/repo -q`.

- [ ] **Step 4: Final review.** A fresh reviewer (opus) over `git diff main...HEAD` with the spec
  and this plan; findings filed as *M4.8a final review — findings*; Critical and Important fixed
  test-first; minors deferred to issues.

- [ ] **Step 5: Commit, push, open the pull request** (`Closes #<n>` once per line for each
  M4.8a sub-issue). Merge only on the operator's yes.

```bash
git add CLAUDE.md docs
git commit -m "docs: M4.8a's journal entry, the spec's notes, and the plan ticked — M4.8a.10"
git push -u origin feat/m4-8a-sign-in-and-team
```
