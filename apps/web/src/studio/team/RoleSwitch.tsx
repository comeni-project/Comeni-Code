// The Author · Reviewer · Operator switch of the S14 board: real radio inputs, drawn as a
// segmented control.
import { useId } from "react";
import { ROLE_LABEL, ROLES, type Role } from "../../api/accounts";

interface Props {
  label: string;
  value: string;
  onChange: (role: Role) => void;
  disabled?: boolean;
}

export function RoleSwitch({ label, value, onChange, disabled = false }: Props) {
  const name = useId();
  return (
    <fieldset className="flex self-start rounded-control border border-border bg-bg p-[3px]">
      <legend className="sr-only">{label}</legend>
      {ROLES.map((role) => (
        <label
          key={role}
          className={`cursor-pointer rounded-[7px] px-3 py-1 text-[12.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sel ${
            value === role ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
          }`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === role}
            disabled={disabled}
            onChange={() => onChange(role)}
          />
          {ROLE_LABEL[role]}
        </label>
      ))}
    </fieldset>
  );
}
