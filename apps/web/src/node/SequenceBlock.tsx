// A sequence block (M4.8c spec, M4Q.2): DNA, RNA or protein letters, monospaced in groups of ten.
export function SequenceBlock({ letters }: { letters: string }) {
  const groups = letters.replace(/\s+/g, "").match(/.{1,10}/g) ?? [];
  return (
    <p className="my-1 rounded-[10px] border border-border bg-surface px-4 py-3 font-mono text-[14px] tracking-[0.06em] break-all">
      {groups.join(" ")}
    </p>
  );
}
