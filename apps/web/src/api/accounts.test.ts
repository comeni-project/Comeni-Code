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
