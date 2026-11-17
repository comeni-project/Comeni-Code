// The AI page (M5.1 spec, M5G.7), as the AISettings, AISignIn and AIUsageM5 boards draw it.
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AISettingsOut, UsageOut } from "../../api/schema";
import { answering, holding, renderAt, signedInAs } from "../../test-kit";
import { pagesFor } from "../pages";
import { AIPage } from "./AIPage";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const site = (key: string, label: string, extra: Partial<AISettingsOut["sites"][number]> = {}) => ({
  key,
  label,
  who: "authors",
  refused: "stop and say so",
  wired: "M5" as const,
  same_as_default: key !== "default",
  connection: null,
  model: "",
  minimum_score: 3,
  max_redrafts: 1,
  cap: null,
  default_cap: 200,
  temperature: null,
  reasoning_effort: "",
  timeout: null,
  locked: false,
  problem: null,
  ...extra,
});

const SETTINGS: AISettingsOut = {
  connections: [
    {
      id: 1,
      name: "Local Ollama",
      kind: "self-hosted",
      endpoint: "http://ollama:11434/v1",
      key: null,
      status: "ok",
      tested_at: "2026-11-13T10:00:00Z",
      models: ["openai/qwen2.5:7b"],
      locked: false,
    },
    {
      id: 2,
      name: "Anthropic",
      kind: "hosted",
      endpoint: "",
      key: "set ····7f2a",
      status: "untested",
      tested_at: null,
      models: [],
      locked: false,
    },
  ],
  sites: [
    site("default", "Default", {
      same_as_default: false,
      connection: 1,
      model: "openai/qwen2.5:7b",
    }),
    site("page-drafting", "Page drafting"),
    site("figure-data", "Figure data and problems", {
      same_as_default: false,
      problem: "Figure data and problems's connection was removed: choose a model.",
    }),
    site("connecting-text", "Connecting text", { wired: "M7" }),
  ],
  chatgpt_ready: true,
  settings_key_ready: true,
};

const USAGE: UsageOut = {
  range: "month",
  calls: 1284,
  tokens: 3100000,
  cost: "4.20",
  plan_calls: 1190,
  refused: 6,
  by_site: [
    {
      site: "block-evaluation",
      label: "Block evaluation (judge)",
      calls: 610,
      cost: null,
      priced: "plan",
    },
    {
      site: "figure-data",
      label: "Figure data and problems",
      calls: 10,
      cost: "4.20",
      priced: "billed",
    },
    {
      site: "resource-suggestion",
      label: "Resource suggestion",
      calls: 1,
      cost: null,
      priced: "local",
    },
  ],
  by_person: [{ name: "ada@example.org", calls: 520 }],
  recent: [
    {
      at: "2026-11-13T10:00:00Z",
      site: "page-drafting",
      who: "ada@example.org",
      model: "chatgpt/gpt-6.1-sol",
      tokens: 5902,
      duration_ms: 11000,
      outcome: "answered",
      code: "",
    },
  ],
};

const open = (extra: Parameters<typeof answering>[0] = {}, path = "/studio/ai") => {
  const fake = answering({
    "GET /api/me": signedInAs("operator"),
    "GET /api/studio/ai/settings": { body: SETTINGS },
    ...extra,
  });
  renderAt(path, <Route path="/studio/ai" element={<AIPage />} />);
  return fake;
};
const bodyOf = (fake: ReturnType<typeof answering>, method: string, url: string) =>
  fake.mock.calls
    .filter(([u, init]) => u === url && init?.method === method)
    .map(([, init]) => JSON.parse(String(init?.body ?? "{}")));

it("is in the rail for operators only", () => {
  expect(pagesFor("operator").some((p) => p.path === "/studio/ai")).toBe(true);
  expect(pagesFor("reviewer").some((p) => p.path === "/studio/ai")).toBe(false);
});

describe("Models", () => {
  it("lists the connections with their status, a key shown only as set", async () => {
    open();
    const row = await screen.findByRole("row", { name: /Anthropic/ });
    expect(within(row).getByText("set ····7f2a")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /^Local Ollama/ })).getByText("ok")).toBeTruthy();
  });

  it("adds a self-hosted connection and shows the answer", async () => {
    const after = { ...SETTINGS, connections: [...SETTINGS.connections] };
    const fake = open({ "POST /api/studio/ai/connections": { body: after } });
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a connection" }));
    await userEvent.click(screen.getByRole("radio", { name: "Self-hosted" }));
    await userEvent.type(screen.getByLabelText("Name"), "Box");
    await userEvent.type(screen.getByLabelText("Endpoint"), "http://box:8000");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() =>
      expect(bodyOf(fake, "POST", "/api/studio/ai/connections")).toEqual([
        { name: "Box", kind: "self-hosted", endpoint: "http://box:8000", key: null },
      ]),
    );
  });

  it("tests a connection", async () => {
    const fake = open({ "POST /api/studio/ai/connections/2/test": { body: SETTINGS } });
    const row = await screen.findByRole("row", { name: /Anthropic/ });
    await userEvent.click(within(row).getByRole("button", { name: "Test" }));
    await vi.waitFor(() =>
      expect(bodyOf(fake, "POST", "/api/studio/ai/connections/2/test")).toHaveLength(1),
    );
  });

  it("sets a site's model from a connection's list, and its cap", async () => {
    const fake = open({ "PUT /api/studio/ai/sites/page-drafting": { body: SETTINGS } });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.selectOptions(
      within(row).getByLabelText("Model for Page drafting"),
      "1|openai/qwen2.5:7b",
    );
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting")[0]).toMatchObject({
        same_as_default: false,
        connection: 1,
        model: "openai/qwen2.5:7b",
      }),
    );
    const cap = within(row).getByLabelText("Cap for Page drafting");
    await userEvent.type(cap, "50");
    await userEvent.tab();
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting").at(-1)).toMatchObject({
        cap: 50,
      }),
    );
  });

  it("clears a site's call settings when its model changes", async () => {
    const tuned = {
      ...SETTINGS,
      sites: SETTINGS.sites.map((s) =>
        s.key === "page-drafting" ? { ...s, temperature: 1, reasoning_effort: "high" } : s,
      ),
    };
    const fake = open({
      "GET /api/studio/ai/settings": { body: tuned },
      "PUT /api/studio/ai/sites/page-drafting": { body: tuned },
    });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.selectOptions(
      within(row).getByLabelText("Model for Page drafting"),
      "1|openai/qwen2.5:7b",
    );
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting")[0]).toMatchObject({
        temperature: null,
        reasoning_effort: "",
        timeout: null,
      }),
    );
  });

  it("types a hosted provider's model, as provider/model", async () => {
    const fake = open({ "PUT /api/studio/ai/sites/page-drafting": { body: SETTINGS } });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.selectOptions(within(row).getByLabelText("Model for Page drafting"), "2|");
    const typed = within(row).getByLabelText("Anthropic model for Page drafting");
    await userEvent.type(typed, "anthropic/claude-sonnet-5");
    await userEvent.tab();
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting").at(-1)).toMatchObject({
        same_as_default: false,
        connection: 2,
        model: "anthropic/claude-sonnet-5",
      }),
    );
  });

  it("sets a site's call settings", async () => {
    const fake = open({ "PUT /api/studio/ai/sites/page-drafting": { body: SETTINGS } });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.click(within(row).getByText("Call settings"));
    await userEvent.type(within(row).getByLabelText("Temperature"), "1");
    await userEvent.selectOptions(within(row).getByLabelText("Reasoning effort"), "high");
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting").at(-1)).toMatchObject({
        reasoning_effort: "high",
      }),
    );
    await userEvent.click(within(row).getByLabelText("Timeout, seconds"));
    await vi.waitFor(() =>
      expect(
        bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting").some((b) => b.temperature === 1),
      ).toBe(true),
    );
  });

  it.each(["hosted", "default"])("clears call settings when switching to %s (#463)", async (to) => {
    const tuned = {
      ...SETTINGS,
      sites: SETTINGS.sites.map((s) =>
        s.key === "page-drafting"
          ? {
              ...s,
              same_as_default: false,
              connection: 1,
              model: "openai/qwen2.5:7b",
              temperature: 0.7,
              reasoning_effort: "high",
              timeout: 30,
            }
          : s,
      ),
    };
    const cleared = {
      ...SETTINGS,
      sites: SETTINGS.sites.map((s) =>
        s.key !== "page-drafting"
          ? s
          : {
              ...s,
              same_as_default: to === "default",
              connection: to === "default" ? null : 2,
              model: to === "default" ? "" : "anthropic/claude-sonnet-5",
            },
      ),
    };
    const fake = open({
      "GET /api/studio/ai/settings": { body: tuned },
      "PUT /api/studio/ai/sites/page-drafting": { body: cleared },
    });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.click(within(row).getByText("Call settings"));
    await userEvent.selectOptions(
      within(row).getByLabelText("Model for Page drafting"),
      to === "default" ? "same" : "2|",
    );
    if (to === "hosted") {
      await userEvent.type(
        within(row).getByLabelText("Anthropic model for Page drafting"),
        "anthropic/claude-sonnet-5",
      );
      await userEvent.tab();
    }
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/sites/page-drafting").at(-1)).toMatchObject({
        temperature: null,
        reasoning_effort: "",
        timeout: null,
      }),
    );
    await vi.waitFor(() =>
      expect((within(row).getByLabelText("Temperature") as HTMLInputElement).value).toBe(""),
    );
  });

  it("edits a connection: a new key, the old one kept when left empty (#458)", async () => {
    const fake = open({ "PUT /api/studio/ai/connections/2": { body: SETTINGS } });
    const row = await screen.findByRole("row", { name: /^Anthropic/ });
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("group", { name: "Edit Anthropic" });
    expect((within(form).getByLabelText("Name") as HTMLInputElement).value).toBe("Anthropic");
    await userEvent.type(within(form).getByLabelText(/^New key/), "sk-new-9876");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/connections/2")[0]).toEqual({
        name: "Anthropic",
        key: "sk-new-9876",
      }),
    );
    expect(screen.queryByRole("group", { name: "Edit Anthropic" })).toBeNull();
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Edit Anthropic" })).getByRole("button", {
        name: "Save",
      }),
    );
    await vi.waitFor(() =>
      expect(bodyOf(fake, "PUT", "/api/studio/ai/connections/2")[1]).toEqual({
        name: "Anthropic",
      }),
    );
  });

  it("shows call settings as saved after a new model clears them (#459)", async () => {
    const tuned = {
      ...SETTINGS,
      sites: SETTINGS.sites.map((s) =>
        s.key === "page-drafting" ? { ...s, temperature: 0.7, timeout: 30 } : s,
      ),
    };
    const cleared = {
      ...SETTINGS,
      sites: SETTINGS.sites.map((s) =>
        s.key === "page-drafting"
          ? { ...s, same_as_default: false, connection: 1, model: "openai/qwen2.5:7b" }
          : s,
      ),
    };
    open({
      "GET /api/studio/ai/settings": { body: tuned },
      "PUT /api/studio/ai/sites/page-drafting": { body: cleared },
    });
    const row = await screen.findByRole("row", { name: /^Page drafting/ });
    await userEvent.click(within(row).getByText("Call settings"));
    expect((within(row).getByLabelText("Temperature") as HTMLInputElement).value).toBe("0.7");
    await userEvent.selectOptions(
      within(row).getByLabelText("Model for Page drafting"),
      "1|openai/qwen2.5:7b",
    );
    await vi.waitFor(() =>
      expect((within(row).getByLabelText("Temperature") as HTMLInputElement).value).toBe(""),
    );
    expect((within(row).getByLabelText("Timeout, seconds") as HTMLInputElement).value).toBe("");
  });

  it("says why a site has no model, and greys the M7 sites", async () => {
    open();
    expect(await screen.findByText(/connection was removed: choose a model/)).toBeTruthy();
    const later = screen.getByRole("row", { name: /^Connecting text/ });
    expect(within(later).getByText("arrives with its screen (M7)")).toBeTruthy();
    expect(within(later).queryByRole("combobox")).toBeNull();
  });
});

describe("Sign in with ChatGPT", () => {
  it("shows the code and the link, asks while waiting, then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let asks = 0;
    const fake = open({
      "POST /api/studio/ai/chatgpt/sign-in": {
        body: {
          user_code: "K7QF-9MZD",
          link: "https://auth.openai.com/codex/device",
          expires_at: 0,
        },
      },
      "GET /api/studio/ai/chatgpt/sign-in": () => {
        asks += 1;
        return { body: { state: asks < 2 ? "waiting" : "signed-in" } };
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a connection" }));
    await userEvent.click(screen.getByRole("radio", { name: "ChatGPT plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Sign in with ChatGPT" }));
    expect(await screen.findByText("K7QF-9MZD")).toBeTruthy();
    expect(screen.getByRole("link", { name: /auth.openai.com\/codex\/device/ })).toBeTruthy();
    expect(screen.getByText(/Never share this code/)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(await screen.findByText(/Signed in/)).toBeTruthy();
    const polls = () =>
      fake.mock.calls.filter(
        ([u, init]) => u === "/api/studio/ai/chatgpt/sign-in" && (init?.method ?? "GET") === "GET",
      ).length;
    const settled = polls();
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(polls()).toBe(settled);
  });

  it("asks once at a time: the next ask waits for the last answer (#455)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fake = open({
      "POST /api/studio/ai/chatgpt/sign-in": {
        body: {
          user_code: "K7QF-9MZD",
          link: "https://auth.openai.com/codex/device",
          expires_at: 0,
        },
      },
      "GET /api/studio/ai/chatgpt/sign-in": { body: { state: "signed-in" } },
    });
    const answer = holding(fake, "GET /api/studio/ai/chatgpt/sign-in");
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a connection" }));
    await userEvent.click(screen.getByRole("radio", { name: "ChatGPT plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Sign in with ChatGPT" }));
    await screen.findByText("K7QF-9MZD");
    const polls = () =>
      fake.mock.calls.filter(
        ([u, init]) => u === "/api/studio/ai/chatgpt/sign-in" && (init?.method ?? "GET") === "GET",
      ).length;
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(polls()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(15000)); // the first ask is still out
    expect(polls()).toBe(1);
    await act(async () => answer({ body: { state: "signed-in" } }));
    expect(await screen.findByText(/Signed in/)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(polls()).toBe(1);
  });
});

describe("Usage", () => {
  it("shows the totals, cost only where billed, and asks once per range", async () => {
    const fake = open(
      {
        "GET /api/studio/ai/usage?range=month": { body: USAGE },
        "GET /api/studio/ai/usage?range=today": { body: { ...USAGE, range: "today", calls: 7 } },
      },
      "/studio/ai?tab=usage",
    );
    expect(await screen.findByText("1,284")).toBeTruthy();
    const judge = screen.getByRole("row", { name: /Block evaluation/ });
    expect(within(judge).getByText("plan")).toBeTruthy();
    expect(
      within(screen.getByRole("row", { name: /Figure data/ })).getByText("$4.20"),
    ).toBeTruthy();
    const local = screen.getByRole("row", { name: /Resource suggestion/ });
    expect(within(local).getByText("local")).toBeTruthy();
    expect(within(local).getByText("1 call")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Today" }));
    expect(await screen.findByText("7")).toBeTruthy();
    const asked = fake.mock.calls.filter(([u]) => String(u).startsWith("/api/studio/ai/usage"));
    expect(asked.map(([u]) => u)).toEqual([
      "/api/studio/ai/usage?range=month",
      "/api/studio/ai/usage?range=today",
    ]);
  });
});
