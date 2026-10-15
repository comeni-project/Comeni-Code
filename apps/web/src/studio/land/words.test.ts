import { describe, expect, it } from "vitest";
import { ago, every, fileLabel, who } from "./words";

const NOW = Date.parse("2026-10-15T12:00:00Z");

describe("Land's words", () => {
  it("says how long ago", () => {
    expect(ago("2026-10-15T11:59:40Z", NOW)).toBe("just now");
    expect(ago("2026-10-15T11:56:00Z", NOW)).toBe("4 min ago");
    expect(ago("2026-10-15T09:00:00Z", NOW)).toBe("3 h ago");
    expect(ago("2026-10-14T09:00:00Z", NOW)).toBe("yesterday");
    expect(ago("2026-10-11T09:00:00Z", NOW)).toBe("4 days ago");
  });

  it("says how often", () => {
    expect(every(300)).toBe("every 5 minutes");
    expect(every(60)).toBe("every minute");
    expect(every(45)).toBe("every 45 seconds");
  });

  it("names a person and a file", () => {
    expect(who({ public_id: "u", email: "g@example.org", name: "Grace", role: "reviewer" })).toBe(
      "Grace",
    );
    expect(who({ public_id: "u", email: "g@example.org", name: "", role: "reviewer" })).toBe(
      "g@example.org",
    );
    expect(who(null)).toBe("a former member");
    expect(fileLabel({ file: "body", change: "changed" })).toBe("~body");
    expect(fileLabel({ file: "exam", change: "removed" })).toBe("-exam");
    expect(fileLabel({ file: "node", change: "new" })).toBe("+node");
  });
});
