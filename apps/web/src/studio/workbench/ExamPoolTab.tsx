// The Exam pool tab until M4.8c builds it: what is there, and how many of the four it needs.
import type { DraftNodeOut } from "../../api/schema";

export function ExamPoolTab({ node }: { node: DraftNodeOut }) {
  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-4">
      <p className="text-[14px] font-semibold tabular-nums">{node.exam.length} of 4</p>
      <p className="text-[13.5px] text-ink-2">
        The exam pool's builder is not built yet (M4.8c). Until then, exam questions are added
        through the API.
      </p>
    </section>
  );
}
