// A question in review (M4R.4, M4.9b spec M4RS.4): asked as a test asks it, the key and rationale
// shown only once answered — and whether you were right, which counts but never blocks.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { answeredInto } from "../../api/queries";
import { putAnswer } from "../../api/review";
import type { ReviewQuestionOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { type TestAsk, TestQuestion } from "../../node/TestQuestion";

const LETTERS = "ABCDE";

const shownGiven = (q: ReviewQuestionOut) =>
  q.kind === "choice" && typeof q.given === "number"
    ? (LETTERS[q.given] ?? String(q.given))
    : Array.isArray(q.given)
      ? q.given.join(" → ")
      : String(q.given);

const theKey = (q: ReviewQuestionOut) =>
  q.kind === "choice" && q.right_option !== null
    ? `${LETTERS[q.right_option]} · ${q.options?.[q.right_option] ?? ""}`
    : q.kind === "order"
      ? (q.right_steps ?? []).join(" → ")
      : `${q.value ?? ""}${q.unit ? ` ${q.unit}` : ""}${q.tolerance ? ` (± ${q.tolerance})` : ""}`;

export function ReviewQuestion({
  draftId,
  question,
}: {
  draftId: string;
  question: ReviewQuestionOut;
}) {
  const client = useQueryClient();
  const answer = useMutation({
    mutationFn: (given: unknown) => putAnswer(draftId, question.id, given),
    onSuccess: (graded) => answeredInto(client, draftId, graded),
  });
  const ask: TestAsk = {
    stem:
      question.pool === "exam" ? question.stem : [{ kind: "text", markdown: `${question.ask}\n` }],
    kind: question.kind as TestAsk["kind"],
    options: question.options ?? [],
    unit: question.unit,
    steps: question.steps ?? [],
  };
  return (
    <div className="flex max-w-[620px] flex-col gap-2.5">
      {question.given === null ? (
        <TestQuestion
          ask={ask}
          number={1}
          of={1}
          onAnswer={(given) => answer.mutate(given)}
          busy={answer.isPending}
        />
      ) : (
        <div className="flex flex-col gap-2 text-[14px]">
          <p>{`Your answer: ${shownGiven(question)} · ${question.right ? "right" : "wrong"}`}</p>
          <p className="rounded-[10px] border-2 border-btn bg-line-soft px-3 py-2">
            <span className="text-[12px] text-btn">Right answer · </span>
            {theKey(question)}
          </p>
          {question.rationale && <p className="text-[13.5px] text-ink-2">{question.rationale}</p>}
        </div>
      )}
      {question.hints.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[10px] bg-bg px-3 py-2.5 text-[12.5px] text-ink-2">
          <span className="font-semibold text-ink">Hints the learner sees</span>
          {question.hints.map((hint, at) => (
            <span key={hint}>{`${at + 1} · ${hint}`}</span>
          ))}
        </div>
      )}
      <span className="text-[12px] text-ink-3">
        You answer before the right answer is shown; a wrong answer counts, never blocks.
      </span>
      {answer.error !== null && <ErrorNotice error={answer.error} />}
    </div>
  );
}
