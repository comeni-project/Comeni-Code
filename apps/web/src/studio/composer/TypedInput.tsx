// A text box that keeps what you type while you type it: what it writes may read back otherwise
// (1. as 1), and the copy re-renders on every keystroke (M6CO.2).
import { type ComponentProps, useState } from "react";

export function TypedInput({
  value,
  onType,
  ...rest
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onType: (typed: string) => void;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="text"
      spellCheck={false}
      value={typing ?? value}
      onFocus={() => setTyping(value)}
      onBlur={() => setTyping(null)}
      onChange={(e) => {
        setTyping(e.target.value);
        onType(e.target.value);
      }}
    />
  );
}
