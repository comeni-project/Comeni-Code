// A question in review (M4R.4, M4.9b spec M4RS.4): asked as a test asks it, the key and rationale
// shown only once answered — and whether you were right, which counts but never blocks.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { answeredInto, queryKeys } from "../../api/queries";
import { putAnswer } from "../../api/review";
import type { FigureOut, ReviewQuestionOut } from "../../api/schema";
import { Figure } from "../../figures/Figure";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { type TestAsk, TestQuestion } from "../../node/TestQuestion";

const LETTERS = "ABCDE";

export const shownGiven = (q: ReviewQuestionOut) =>
  q.kind === "choice" && typeof q.given === "number"
    ? (LETTERS[q.given] ?? String(q.given))
    : Array.isArray(q.given)
      ? q.given.join(" → ")
      : String(q.given);

export const theKey = (q: ReviewQuestionOut) =>
  q.kind === "choice" && q.right_option !== null
    ? `${LETTERS[q.right_option]} · ${q.options?.[q.right_option] ?? ""}`
    : q.kind === "order"
      ? (q.right_steps ?? []).join(" → ")
      : `${q.value ?? ""}${q.unit ? ` ${q.unit}` : ""}${q.tolerance ? ` (± ${q.tolerance})` : ""}`;

export function ReviewQuestion({
  draftId,
  question,
  figures = [],
  changed = false,
}: {
  draftId: string;
  question: ReviewQuestionOut;
  /** The figures the question shows: a try question's, or those its stem places (M6FG.5). */
  figures?: FigureOut[];
  /** A changed question's earlier key shows once answered, and only the server has it (#297). */
  changed?: boolean;
}) {
  const client = useQueryClient();
  const answer = useMutation({
    mutationFn: (given: unknown) => putAnswer(draftId, question.id, given),
    onSuccess: (graded) => {
      answeredInto(client, draftId, graded);
      if (changed) void client.invalidateQueries({ queryKey: queryKeys.review(draftId) });
    },
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
      {/* A try question's figure, unnumbered as on the page (M6FG.6); a stem draws its own. */}
      {question.pool === "try" &&
        figures.map((f) => (
          <Figure key={f.stem} record={f} stem={f.stem} caption="" number={null} />
        ))}
      {question.given === null ? (
        <TestQuestion
          ask={ask}
          number={1}
          of={1}
          onAnswer={(given) => answer.mutate(given)}
          figures={figures}
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
