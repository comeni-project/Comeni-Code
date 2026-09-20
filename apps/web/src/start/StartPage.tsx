// The Start page (L1): ask, confirm a target, see the route it would build (M3 part 3 spec).
import { TopBar } from "../layout/TopBar";

export function StartPage() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-7 py-10">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em]">What do you want to learn?</h1>
        <p className="max-w-2xl text-[17px] text-ink-2">
          Name a tool, a topic or a problem. We build a route from pages that already exist — every
          stop says why it's there.
        </p>
      </main>
    </div>
  );
}
