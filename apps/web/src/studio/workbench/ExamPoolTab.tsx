// The Exam pool tab until M4.8d builds it: how many questions there are of the four a self-test
// needs, and how many the live version already holds unchanged (M4.8c spec, M4Q.5).
import type { DraftNodeOut } from "../../api/schema";

export function ExamPoolTab({ node }: { node: DraftNodeOut }) {
  const approved = node.exam.filter((question) => question.state === "approved").length;
  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-4">
      <p className="text-[14px] font-semibold tabular-nums">
        {node.exam.length} of 4 · {approved} approved
      </p>
      <p className="text-[13.5px] text-ink-2">
        The exam pool's builder is not built yet (M4.8d). Until then, exam questions are added
        through the API.
      </p>
    </section>
  );
}
