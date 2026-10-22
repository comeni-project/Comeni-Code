// A check goes to its field (M6.5 spec, M6CO.5): the sheet cell, form control or Describe field
// whose data-path is the problem's path; a row's first cell for a row's path; else Edit as YAML at
// the path's line.
const FOCUSABLE = "input, select, textarea, button";

export function focusPath(path: string, atLine: () => void): void {
  const found = path === "" ? null : document.querySelector(`[data-path="${CSS.escape(path)}"]`);
  const target = found?.matches(FOCUSABLE) ? found : found?.querySelector(FOCUSABLE);
  if (target instanceof HTMLElement) {
    target.focus();
    target.scrollIntoView?.({ block: "center" });
    return;
  }
  atLine();
}

/** A server's problem names its path at the start of its message, as code-schema writes it. */
export function serverPath(message: string): { path: string; message: string } {
  const found = /^((?:data|alt|source|component)[^\s:]*): (.*)$/s.exec(message);
  return found ? { path: found[1] ?? "", message: found[2] ?? "" } : { path: "", message };
}
