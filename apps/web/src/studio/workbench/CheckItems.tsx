// The checklist's items, each with its mark and detail (M4K.6): what Checks and Before you submit
// both list.
import type { ItemOut } from "../../api/schema";

export function CheckItems({ items }: { items: readonly ItemOut[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.rule} className="flex items-start gap-2 text-[12.5px]">
          <span aria-hidden="true" className={item.passed ? "text-ink-2" : "text-open"}>
            {item.passed ? "✓" : "✕"}
          </span>
          <span className="flex flex-col">
            <span className={item.passed ? "text-ink-2" : "font-semibold text-ink"}>
              {item.rule}
            </span>
            {item.detail !== "" && <span className="text-[12px] text-ink-3">{item.detail}</span>}
          </span>
          <span className="sr-only">{item.passed ? "passes" : "does not pass"}</span>
        </li>
      ))}
    </ul>
  );
}
