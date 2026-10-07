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
  const answer = await sendJson<AllauthAnswer>(
    "POST",
    `${BASE}${path}`,
    body,
    [400, 401, 403, 409],
  );
  if (!done.includes(answer.status)) throw FormRefused.of(answer);
}

export const signIn = (email: string, password: string) => post("/auth/login", { email, password });

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
  const fields = {
    provider,
    callback_url: next,
    process: "login",
    csrfmiddlewaretoken: csrfToken(),
  };
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
