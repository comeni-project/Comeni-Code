import { afterEach, describe, expect, it, vi } from "vitest";
import { answering } from "../test-kit";
import { continueWith, FormRefused, fetchProviders, resetPassword, signIn, signOut } from "./auth";

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

  it("words a deactivated account and too many tries (#234)", async () => {
    answering({
      "POST /_allauth/browser/v1/auth/login": { status: 401, body: { status: 401 } },
    });
    const inactive = (await signIn("a@b.c", "x").catch((e: unknown) => e)) as FormRefused;
    expect(inactive.byField[""]).toEqual([
      "This account can’t sign in; it may have been deactivated. Ask an operator.",
    ]);
    answering({
      "POST /_allauth/browser/v1/auth/login": { status: 429, body: { status: 429 } },
    });
    const limited = (await signIn("a@b.c", "x").catch((e: unknown) => e)) as FormRefused;
    expect(limited.byField[""]).toEqual(["Too many tries; wait a few minutes and try again."]);
  });

  it("takes allauth's 401 as signed out", async () => {
    answering({
      "DELETE /_allauth/browser/v1/auth/session": { status: 401, body: { status: 401 } },
    });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("takes a reset's 401 as done", async () => {
    answering({
      "POST /_allauth/browser/v1/auth/password/reset": { status: 401, body: { status: 401 } },
    });
    await expect(resetPassword("k", "pw")).resolves.toBeUndefined();
  });

  it("leaves for a provider through allauth's form", () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("csrftoken=tok");
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
