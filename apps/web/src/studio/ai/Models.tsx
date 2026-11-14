// The AI page's Models (M5G.3, M5G.5, M5G.7): the connections, adding one, and a model, cap and
// call settings per call site. A key is never shown: only that one is set.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addConnection,
  changeConnection,
  removeConnection,
  setSite,
  testConnection,
} from "../../api/ai";
import { sentenceOf } from "../../api/client";
import { queryKeys, useAISettings } from "../../api/queries";
import type { AISettingsOut, ConnectionOut, SiteOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { ChatGPTSignIn } from "./ChatGPTSignIn";
import { Segmented } from "./Segmented";

const PANEL = "flex flex-col overflow-hidden rounded-panel border border-border bg-surface";
const BUTTON =
  "rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-sel disabled:opacity-60";
const INPUT =
  "h-9 rounded-control border border-border-2 bg-surface px-2.5 text-[13.5px] outline-none focus:border-sel";
const KINDS = {
  chatgpt: "ChatGPT plan",
  "self-hosted": "Self-hosted",
  hosted: "A hosted provider",
  env: "A hosted provider",
} as const;

function useWrite() {
  const client = useQueryClient();
  const [trouble, setTrouble] = useState<string | null>(null);
  const run = async (write: () => Promise<AISettingsOut>) => {
    setTrouble(null);
    try {
      client.setQueryData(queryKeys.ai, await write());
      return true;
    } catch (error) {
      setTrouble(error instanceof Error ? sentenceOf(error) : String(error));
      return false;
    }
  };
  return { run, trouble };
}

export function Models() {
  const settings = useAISettings();
  const { run, trouble } = useWrite();
  if (settings.isPending) return <p className="text-[14px] text-ink-2">Loading the AI settings…</p>;
  if (settings.isError) return <ErrorNotice error={settings.error} />;
  const state = settings.data;
  return (
    <>
      {trouble !== null && (
        <p
          role="alert"
          className="m-0 rounded-control bg-open-soft px-4 py-2.5 text-[13.5px] text-open"
        >
          {trouble}
        </p>
      )}
      <Connections state={state} run={run} />
      <Sites state={state} run={run} />
      {state.connections.length === 0 && (
        <p className="m-0 text-[13px] text-ink-2">
          With no connection, nothing calls a model. Every page still works: routes are computed,
          learners get search instead of suggestions, and authors write by hand.
        </p>
      )}
    </>
  );
}

type Run = (write: () => Promise<AISettingsOut>) => Promise<boolean>;

function Connections({ state, run }: { state: AISettingsOut; run: Run }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <section className={PANEL} aria-labelledby="ai-connections">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="ai-connections" className="m-0 text-[15px] font-semibold">
            Connections
          </h2>
          <span className="text-[12.5px] text-ink-3">
            Keys are kept encrypted and never sent back: you see that one is set, and its last four
            characters.
          </span>
        </div>
        <button type="button" className={BUTTON} onClick={() => setAdding(!adding)}>
          + Add a connection
        </button>
      </div>
      {adding && <AddConnection state={state} run={run} onDone={() => setAdding(false)} />}
      {state.connections.length > 0 && (
        <table className="w-full border-collapse text-left text-[13.5px]">
          <tbody>
            {state.connections.flatMap((c) => [
              <tr
                key={`${c.id}:${c.name}`}
                className={`border-t border-border ${c.locked ? "bg-bg" : ""}`}
              >
                <td className="px-4 py-3 font-semibold">
                  {c.name}
                  {c.locked && (
                    <span className="block text-[12px] font-normal text-ink-3">
                      locked: .env wins over this page
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-ink-2">{KINDS[c.kind]}</td>
                <td className="px-2 py-3 font-mono text-[12.5px] text-ink-2">
                  {c.key ?? (c.endpoint || (c.kind === "chatgpt" ? "chatgpt/ · no key" : ""))}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[12px] font-medium ${
                      c.status === "ok"
                        ? "bg-line-soft text-btn"
                        : c.status === "untested" || c.locked
                          ? "border border-border-2 text-ink-2"
                          : "bg-open-soft text-open"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {c.locked ? (
                    <span className="text-[12.5px] text-ink-3">change it in .env</span>
                  ) : (
                    <span className="inline-flex gap-2">
                      <button
                        type="button"
                        className={BUTTON}
                        onClick={() => run(() => testConnection(c.id))}
                      >
                        Test
                      </button>
                      {c.kind !== "chatgpt" && (
                        <button
                          type="button"
                          className={BUTTON}
                          aria-expanded={editing === c.id}
                          onClick={() => setEditing(editing === c.id ? null : c.id)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className={BUTTON}
                        onClick={() => run(() => removeConnection(c.id))}
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </td>
              </tr>,
              editing === c.id && (
                <tr key={`${c.id}:edit`} className="border-t border-border">
                  <td colSpan={5} className="p-0">
                    <EditConnection
                      connection={c}
                      state={state}
                      run={run}
                      onDone={() => setEditing(null)}
                    />
                  </td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** A connection's name, endpoint or key changed (#458): a key that cannot be read is entered
 * again here, and the sites that use the connection keep it. An empty key keeps the old one. */
function EditConnection({
  connection,
  state,
  run,
  onDone,
}: {
  connection: ConnectionOut;
  state: AISettingsOut;
  run: Run;
  onDone: () => void;
}) {
  const [name, setName] = useState(connection.name);
  const [endpoint, setEndpoint] = useState(connection.endpoint);
  const [key, setKey] = useState("");
  const save = async () => {
    const done = await run(() =>
      changeConnection(connection.id, {
        name,
        ...(connection.kind === "self-hosted" ? { endpoint } : {}),
        ...(key.trim() !== "" ? { key } : {}),
      }),
    );
    if (done) onDone();
  };
  return (
    <fieldset
      aria-label={`Edit ${connection.name}`}
      className="m-0 flex flex-wrap items-end gap-3 border-0 bg-bg px-4 py-4"
    >
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </label>
      {connection.kind === "self-hosted" ? (
        <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[13px] font-medium">
          Endpoint
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className={`${INPUT} font-mono`}
          />
        </label>
      ) : (
        <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[13px] font-medium">
          New key, or empty to keep {connection.key ?? "none"}
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!state.settings_key_ready}
            className={`${INPUT} font-mono`}
          />
        </label>
      )}
      <button type="button" className={BUTTON} onClick={save} disabled={name.trim() === ""}>
        Save
      </button>
      <button type="button" className={BUTTON} onClick={onDone}>
        Cancel
      </button>
    </fieldset>
  );
}

function AddConnection({
  state,
  run,
  onDone,
}: {
  state: AISettingsOut;
  run: Run;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"self-hosted" | "hosted" | "chatgpt">("self-hosted");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [key, setKey] = useState("");
  const add = async () => {
    const done = await run(() =>
      addConnection({
        name,
        kind: kind === "chatgpt" ? "hosted" : kind,
        endpoint: kind === "self-hosted" ? endpoint : "",
        key: kind === "hosted" ? key : null,
      }),
    );
    if (done) onDone();
  };
  return (
    <div className="flex flex-col gap-3 border-t border-border bg-bg px-4 py-4">
      <Segmented
        label="Kind"
        options={(["self-hosted", "hosted", "chatgpt"] as const).map((k) => ({
          key: k,
          label: KINDS[k],
        }))}
        value={kind}
        onChange={setKind}
        disabled={(k) => k === "chatgpt" && !state.chatgpt_ready}
      />
      {kind === "chatgpt" ? (
        <ChatGPTSignIn />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </label>
          {kind === "self-hosted" ? (
            <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[13px] font-medium">
              Endpoint
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://ollama:11434"
                className={`${INPUT} font-mono`}
              />
            </label>
          ) : (
            <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[13px] font-medium">
              Key
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!state.settings_key_ready}
                className={`${INPUT} font-mono`}
              />
              {!state.settings_key_ready && (
                <span className="text-[12px] font-normal text-ink-3">
                  Keeping a key needs CODE_SETTINGS_KEY in .env.
                </span>
              )}
            </label>
          )}
          <button type="button" className={BUTTON} onClick={add} disabled={name.trim() === ""}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function Sites({ state, run }: { state: AISettingsOut; run: Run }) {
  return (
    <section className={PANEL} aria-labelledby="ai-sites">
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <h2 id="ai-sites" className="m-0 text-[15px] font-semibold">
          Where Code calls a model
        </h2>
        <span className="text-[12.5px] text-ink-3">
          The list is fixed: adding a call site is a reviewed code change. Choosing a model chooses
          its connection.
        </span>
      </div>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-t border-border text-[11.5px] text-ink-3">
            <th className="px-4 py-2 font-normal">Call site</th>
            <th className="px-2 py-2 font-normal">Who calls it</th>
            <th className="px-2 py-2 font-normal">Model</th>
            <th className="px-2 py-2 font-normal">If it is refused</th>
            <th className="px-4 py-2 font-normal">Cap, calls a day</th>
          </tr>
        </thead>
        <tbody>
          {state.sites.map((s) => (
            <SiteRow key={s.key} site={s} state={state} run={run} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SiteRow({ site, state, run }: { site: SiteOut; state: AISettingsOut; run: Run }) {
  const [cap, setCap] = useState(site.cap === null ? "" : String(site.cap));
  const later = site.wired === "M7";
  const current = site.same_as_default ? "same" : `${site.connection ?? 0}|${site.model}`;
  const save = (change: Partial<SiteOut>) => {
    const next = { ...site, ...change };
    return run(() =>
      setSite(site.key, {
        same_as_default: next.same_as_default,
        connection: next.connection,
        model: next.model,
        cap: next.cap,
        temperature: next.temperature,
        reasoning_effort: next.reasoning_effort,
        timeout: next.timeout,
      }),
    );
  };
  const hosted = state.connections.filter((c) => c.kind === "hosted" && !c.locked);
  const onHosted = hosted.find((c) => c.id === site.connection && !site.same_as_default);
  // A hosted provider lists no models, so its model is typed, as provider/model (M5G.3).
  const [typing, setTyping] = useState<number | null>(onHosted?.id ?? null);
  const [typed, setTyped] = useState(onHosted ? site.model : "");
  const choose = (value: string) => {
    if (value === "same") {
      setTyping(null);
      return save({ same_as_default: true, connection: null, model: "" });
    }
    const [id, ...rest] = value.split("|");
    const model = rest.join("|");
    if (model === "" && hosted.some((c) => c.id === Number(id))) {
      setTyping(Number(id));
      setTyped("");
      return Promise.resolve(true);
    }
    setTyping(null);
    // A setting one model takes, another may refuse: a new model starts from the defaults (M5G.5).
    return save({
      same_as_default: false,
      connection: Number(id) || null,
      model,
      temperature: null,
      reasoning_effort: "",
      timeout: null,
    });
  };
  const typingName = hosted.find((c) => c.id === typing)?.name;
  return (
    <tr className={`border-t border-border ${later ? "text-ink-3" : ""}`}>
      <td className="px-4 py-2.5">
        <span className="font-semibold">{site.label}</span>
        {site.problem && (
          <span className="block text-[12px] font-normal text-open">{site.problem}</span>
        )}
      </td>
      <td className="px-2 py-2.5 text-ink-2">{site.who}</td>
      <td className="px-2 py-2.5">
        {later ? (
          <span className="text-[12.5px]">arrives with its screen (M7)</span>
        ) : site.locked ? (
          <span className="font-mono text-[12.5px]">{site.model} · set in .env</span>
        ) : (
          <select
            aria-label={`Model for ${site.label}`}
            value={current}
            onChange={(e) => choose(e.target.value)}
            className={`${INPUT} max-w-[320px]`}
          >
            {site.key !== "default" && <option value="same">same as default</option>}
            {site.key === "default" && !site.model && <option value="0|">choose a model</option>}
            {state.connections
              .filter((c) => !c.locked)
              .flatMap((c) =>
                c.models.map((m) => (
                  <option key={`${c.id}|${m}`} value={`${c.id}|${m}`}>
                    {`${c.name} · ${m}`}
                  </option>
                )),
              )}
            {hosted.map((c) => (
              <option key={`${c.id}|`} value={`${c.id}|`}>
                {`${c.name} · type a model…`}
              </option>
            ))}
            {!site.same_as_default &&
              site.model &&
              !state.connections.some((c) => c.models.includes(site.model)) && (
                <option value={current}>{site.model}</option>
              )}
          </select>
        )}
        {!later && !site.locked && typing !== null && (
          <input
            aria-label={`${typingName} model for ${site.label}`}
            value={typed}
            placeholder="provider/model"
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => {
              if (typed.trim() !== "" && typed !== site.model) {
                void save({ same_as_default: false, connection: typing, model: typed.trim() });
              }
            }}
            className={`${INPUT} mt-1.5 block w-full max-w-[320px] font-mono text-[12.5px]`}
          />
        )}
        {/* keyed by the model: a new one clears its settings, and the fields start again (#459) */}
        {!later && (
          <CallSettings key={`${site.connection}|${site.model}`} site={site} save={save} />
        )}
      </td>
      <td className="px-2 py-2.5 text-ink-2">{site.refused}</td>
      <td className="px-4 py-2.5">
        {!later && (
          <input
            aria-label={`Cap for ${site.label}`}
            inputMode="numeric"
            value={cap}
            placeholder={site.default_cap === null ? "none" : String(site.default_cap)}
            onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              const next = cap === "" ? null : Number(cap);
              if (next !== site.cap) void save({ cap: next });
            }}
            className={`${INPUT} w-24`}
          />
        )}
      </td>
    </tr>
  );
}

function CallSettings({
  site,
  save,
}: {
  site: SiteOut;
  save: (change: Partial<SiteOut>) => Promise<boolean>;
}) {
  const [temperature, setTemperature] = useState(
    site.temperature === null ? "" : String(site.temperature),
  );
  const [timeout, setTimeoutText] = useState(site.timeout === null ? "" : String(site.timeout));
  const numberOf = (text: string) => (text.trim() === "" ? null : Number(text));
  return (
    <details className="mt-1.5 text-[12.5px]">
      <summary className="cursor-pointer text-sel">Call settings</summary>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Temperature
          <input
            inputMode="decimal"
            value={temperature}
            placeholder="default"
            onChange={(e) => setTemperature(e.target.value)}
            onBlur={() => {
              const next = numberOf(temperature);
              if (next !== site.temperature && !Number.isNaN(next))
                void save({ temperature: next });
            }}
            className={`${INPUT} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1">
          Reasoning effort
          <select
            value={site.reasoning_effort}
            onChange={(e) => void save({ reasoning_effort: e.target.value })}
            className={INPUT}
          >
            <option value="">default</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Timeout, seconds
          <input
            inputMode="numeric"
            value={timeout}
            placeholder="60"
            onChange={(e) => setTimeoutText(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              const next = numberOf(timeout);
              if (next !== site.timeout) void save({ timeout: next });
            }}
            className={`${INPUT} w-24`}
          />
        </label>
      </div>
      <span className="mt-1 block text-ink-3">
        Empty keeps the installation’s. Choosing another model clears these.
      </span>
    </details>
  );
}
