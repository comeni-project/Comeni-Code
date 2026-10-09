// An edit saves when you leave what you changed (M4K.3): focus moving outside this box calls
// `onLeave`; moving within it does not, nor does a press inside that takes no focus (its padding,
// a caption, or a button in Safari, which does not focus buttons) (#255).
import { type ReactNode, useRef } from "react";

const PLAIN = "flex flex-col gap-2.5 border-0 p-0";

export function LeaveToSave({
  onLeave,
  className = PLAIN,
  children,
}: {
  onLeave: () => void;
  className?: string;
  children: ReactNode;
}) {
  const pressed = useRef(false);
  return (
    <fieldset
      className={`m-0 min-w-0 ${className}`}
      onPointerDown={() => {
        pressed.current = true;
        setTimeout(() => {
          pressed.current = false;
        });
      }}
      onBlur={(event) => {
        const to = event.relatedTarget as Node | null;
        if (to === null && pressed.current) return;
        if (!event.currentTarget.contains(to)) onLeave();
      }}
    >
      {children}
    </fieldset>
  );
}
