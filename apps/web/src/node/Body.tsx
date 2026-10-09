// A node's blocks in the identity, each where the author put it (M3P5.5, M4.1.2): text as Markdown,
// a try as its question, a callout as a boxed note, a sequence in groups of ten (M4Q.2). A kind it
// does not know yet draws nothing.
import type { QuestionOut } from "../api/schema";
import type { Block } from "./body";
import { Callout } from "./Callout";
import { componentsFor, Prose } from "./prose";
import { SequenceBlock } from "./SequenceBlock";
import { TryQuestion } from "./TryQuestion";

export function Body({
  blocks,
  questions,
  big = false,
}: {
  blocks: Block[];
  questions: QuestionOut[];
  big?: boolean;
}) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const components = componentsFor(big);
  let asked = 0;
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "text") {
          if (block.markdown.trim() === "") return null;
          // Keys say what they key, so the third block cannot collide with a question named 2.
          // biome-ignore lint/suspicious/noArrayIndexKey: text blocks have no identity beyond their place
          return <Prose key={`text:${index}`} markdown={block.markdown} components={components} />;
        }
        if (block.kind === "callout") {
          return (
            <Callout
              // biome-ignore lint/suspicious/noArrayIndexKey: callouts have no identity beyond their place
              key={`callout:${index}`}
              kind={block.callout}
              title={block.title}
              markdown={block.markdown}
              components={components}
            />
          );
        }
        if (block.kind === "sequence") {
          // biome-ignore lint/suspicious/noArrayIndexKey: sequences have no identity beyond their place
          return <SequenceBlock key={`sequence:${index}`} letters={block.letters} />;
        }
        if (block.kind !== "try") return null; // a kind this page does not draw yet
        const question = byId.get(block.question);
        if (question === undefined) return null;
        asked += 1;
        return (
          <TryQuestion key={`try:${question.id}`} question={question} number={asked} big={big} />
        );
      })}
    </>
  );
}
