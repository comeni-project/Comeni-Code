// A choice of a few, drawn as a segmented control from real radio inputs (as RoleSwitch is).
import { useId } from "react";

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = () => false,
}: {
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  disabled?: (key: T) => boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex w-fit rounded-control border border-border bg-bg p-[3px]">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.key}
          className={`cursor-pointer rounded-[7px] px-3 py-1 text-[13px] has-[:disabled]:cursor-default has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sel ${
            value === option.key ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
          }`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === option.key}
            disabled={disabled(option.key)}
            onChange={() => onChange(option.key)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
