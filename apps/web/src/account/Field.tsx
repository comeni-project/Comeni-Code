// One labelled input, its hint, and allauth's sentences about it (M4S.3).
import { useId } from "react";

interface FieldProps {
  label: string;
  type?: "email" | "password" | "text";
  value: string;
  onChange?: ((value: string) => void) | undefined;
  hint?: string | undefined;
  errors?: readonly string[] | undefined;
  locked?: boolean;
  autoComplete?: string | undefined;
}

export function Field(props: FieldProps) {
  const { label, type = "text", value, onChange, hint, errors = [], locked = false } = props;
  const id = useId();
  const wrong = errors.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={locked}
        autoComplete={props.autoComplete}
        aria-invalid={wrong}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-10 rounded-control border px-3 text-[14px] outline-none focus:border-sel ${
          locked ? "bg-bg text-ink-2" : "bg-surface"
        } ${wrong ? "border-open" : "border-border-2"}`}
      />
      {hint !== undefined && <span className="text-[12.5px] text-ink-3">{hint}</span>}
      {errors.map((error) => (
        <span key={error} className="text-[12.5px] text-open">
          {error}
        </span>
      ))}
    </div>
  );
}
