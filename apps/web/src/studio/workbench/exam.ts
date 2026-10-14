// An exam question as the builder holds and sends it (M4.8d spec, M4P.5): a new one named in both
// pools, a draft's own turned back into what the API takes, and the stem as it is sent.
import type {
  BlockIn,
  DraftNodeOut,
  ExamQuestionIn,
  StudioExamQuestionOut,
} from "../../api/schema";
import type { Block } from "../../node/body";
import type { TestAsk } from "../../node/TestQuestion";
import { blankExamOptions } from "./AnswerEditor";
import { newQuestion } from "./question";

export function newExamQuestion(nodeId: string, node: DraftNodeOut): ExamQuestionIn {
  const { id } = newQuestion(nodeId, [...node.questions, ...node.exam]);
  return {
    id,
    kind: "choice",
    title: "",
    claim: "",
    stem: [{ kind: "text", markdown: "" }],
    level: null,
    options: blankExamOptions(),
    answer: null,
    unit: "",
    tolerance: null,
    accept: [],
    exact: false,
    steps: null,
    rationale: "",
  };
}

export function examIn(out: StudioExamQuestionOut): ExamQuestionIn {
  return {
    id: out.id,
    kind: out.kind as ExamQuestionIn["kind"],
    title: out.title,
    claim: out.claim,
    stem: out.stem.map((block) => ({ ...block }) as BlockIn),
    level: (out.level ?? null) as NonNullable<ExamQuestionIn["level"]> | null,
    options:
      out.options?.map(({ text, right, misconception, plain }) => ({
        text,
        right,
        misconception,
        plain,
      })) ?? null,
    answer: out.answer,
    unit: out.unit,
    tolerance: out.tolerance,
    accept: out.accept,
    exact: out.exact,
    steps: out.steps,
    rationale: out.rationale,
  };
}

/** Spaces at a line's end: Markdown's hard break, which a stem cannot hold (CS0823). */
const trimmed = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/ +$/, ""))
    .join("\n");
const ended = (text: string) => (text.endsWith("\n") ? text : `${text}\n`);

/** The stem as sent: each block's last line ended (#256), spaces at line ends gone, empty blocks
 * dropped. */
export function stemIn(stem: BlockIn[]): BlockIn[] {
  return stem.flatMap((block): BlockIn[] => {
    if (block.kind === "sequence") {
      const letters = trimmed(block.letters ?? "");
      return letters.trim() === "" ? [] : [{ ...block, letters: ended(letters) }];
    }
    const markdown = trimmed(block.markdown ?? "");
    return markdown.trim() === "" ? [] : [{ ...block, markdown: ended(markdown) }];
  });
}

/** The question as sent: its stem as `stemIn` makes it, and accepted answers without blank lines. */
export function sent(question: ExamQuestionIn): ExamQuestionIn {
  return {
    ...question,
    stem: stemIn(question.stem),
    accept: (question.accept ?? []).filter((answer) => answer.trim() !== ""),
  };
}

/** The question as a test asks it (M4P.7), drawn from what the editor holds: the stem as sent. */
export function testAskOf(question: ExamQuestionIn): TestAsk {
  return {
    kind: question.kind,
    stem: stemIn(question.stem).map(
      (block): Block =>
        block.kind === "sequence"
          ? { kind: "sequence", letters: block.letters ?? "" }
          : { kind: "text", markdown: block.markdown ?? "" },
    ),
    options: (question.options ?? []).map((option) => option.text),
    unit: question.unit ?? "",
    steps: (question.steps ?? []).filter((step) => step.trim() !== ""),
  };
}
