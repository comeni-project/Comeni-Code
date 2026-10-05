// A failed question to the API, said in words in the one colour that means "needs you" (W10).
import { sentenceOf } from "../api/client";

export function ErrorNotice({ error }: { error: Error }) {
  return (
    <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
      {sentenceOf(error)}
    </p>
  );
}
