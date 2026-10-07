// The page and card every account screen is drawn in, as on the L14 and L15 boards (M4S.6).
import type { ReactNode } from "react";
import { TopBar } from "../layout/TopBar";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="flex flex-wrap items-start justify-center gap-14 px-4 pt-14 pb-16">
        {children}
      </main>
    </div>
  );
}

interface CardProps {
  title: string;
  lead?: ReactNode;
  tag?: ReactNode;
  children?: ReactNode;
}

export function AuthCard({ title, lead, tag, children }: CardProps) {
  return (
    <section className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-panel border border-border bg-surface p-8">
      {tag}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        {lead !== undefined && <p className="text-[14px] leading-relaxed text-ink-2">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** The sentences about the whole form, in the colour that means "needs you". */
export function FormErrors({ errors = [] }: { errors?: readonly string[] | undefined }) {
  return errors.map((error) => (
    <p key={error} className="rounded-control bg-open-soft px-3.5 py-2.5 text-[13.5px] text-open">
      {error}
    </p>
  ));
}
