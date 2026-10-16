// A formula's TeX (M6.2 spec, M6MX.4), drawn under the box as learners will see it; Studio marks
// one KaTeX cannot read, with KaTeX's message. On a page or in a stem.
import { useId } from "react";
import { Formula } from "../../node/Formula";

export function MathField({
  value,
  onChange,
  label = "TeX",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={Math.min(8, Math.max(2, value.split("\n").length + 1))}
        spellCheck={false}
        className="rounded-control border border-border-2 bg-surface px-3 py-2 font-mono text-[13.5px] leading-[1.6] outline-none focus:border-sel"
      />
      {value.trim() !== "" && <Formula tex={value} display />}
    </div>
  );
}
