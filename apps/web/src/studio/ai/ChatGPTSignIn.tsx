// Sign in with ChatGPT, in the page (M5.1 spec, M5G.4; the AISignIn board). The page drives the
// wait: it asks once every 5 seconds while the code waits for approval, and stops when it is
// approved, refused or left. The token stays with the API.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { pollSignIn, startSignIn } from "../../api/ai";
import { sentenceOf } from "../../api/client";
import { queryKeys } from "../../api/queries";
import type { SignInOut } from "../../api/schema";

const POLL_MS = 5000;
type Step = { at: "start" } | { at: "waiting"; code: SignInOut } | { at: "signed-in" };

export function ChatGPTSignIn() {
  const client = useQueryClient();
  const [step, setStep] = useState<Step>({ at: "start" });
  const [trouble, setTrouble] = useState<string | null>(null);

  useEffect(() => {
    if (step.at !== "waiting") return;
    // One ask at a time: the next is set only once the last has answered, and an answer that
    // arrives after the page has moved on is ignored (#455).
    let left = false;
    let timer = 0;
    const ask = async () => {
      try {
        const answer = await pollSignIn();
        if (left) return;
        if (answer.state === "signed-in") {
          setStep({ at: "signed-in" });
          void client.invalidateQueries({ queryKey: queryKeys.ai });
          return;
        }
      } catch (error) {
        if (left) return;
        setTrouble(error instanceof Error ? sentenceOf(error) : String(error));
        setStep({ at: "start" });
        return;
      }
      timer = window.setTimeout(ask, POLL_MS);
    };
    timer = window.setTimeout(ask, POLL_MS);
    return () => {
      left = true;
      window.clearTimeout(timer);
    };
  }, [step, client]);

  const begin = async () => {
    setTrouble(null);
    try {
      setStep({ at: "waiting", code: await startSignIn() });
    } catch (error) {
      setTrouble(error instanceof Error ? sentenceOf(error) : String(error));
    }
  };

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {trouble !== null && <p className="m-0 text-[13.5px] text-open">{trouble}</p>}
      {step.at === "start" && (
        <>
          <p className="m-0 max-w-[70ch] text-[14px] leading-relaxed text-ink-2">
            A ChatGPT plan that includes Codex answers Code’s calls with no API key. Calls count
            against the plan’s limits. Turn on device code sign-in in ChatGPT’s security settings
            first.
          </p>
          <button
            type="button"
            onClick={begin}
            className="self-start rounded-control bg-btn px-4 py-2 text-[14px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)]"
          >
            Sign in with ChatGPT
          </button>
        </>
      )}
      {step.at === "waiting" && (
        <>
          <p className="m-0 text-[14px] text-ink-2">
            Open the link, sign in to ChatGPT and enter this code. This page waits for you.
          </p>
          <div className="flex flex-wrap items-center gap-4 rounded-[10px] bg-surface px-4 py-3">
            <span className="font-mono text-[24px] font-semibold tracking-[0.1em]">
              {step.code.user_code}
            </span>
            <a
              href={step.code.link}
              target="_blank"
              rel="noreferrer"
              className="text-[13.5px] font-medium text-sel"
            >
              {step.code.link.replace("https://", "")} ↗
            </a>
          </div>
          <span className="text-[12.5px] text-ink-3">
            Waiting for you to approve · the code lasts 15 minutes. Device codes are a common
            phishing target. Never share this code.
          </span>
        </>
      )}
      {step.at === "signed-in" && (
        <p className="m-0 rounded-[10px] bg-line-soft px-4 py-3 text-[14px] font-semibold text-btn">
          Signed in. The ChatGPT plan is a connection now; choose its model for a call site.
        </p>
      )}
    </div>
  );
}
