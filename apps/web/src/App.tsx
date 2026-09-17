// Two pages until M3 chooses a router (M0 part 7 spec, P7.2): health at /, the specimen at /identity.
import { HealthPage } from "./health/HealthPage";
import { Specimen } from "./identity/Specimen";
import { TopBar } from "./layout/TopBar";

export function App({ path = window.location.pathname }: { path?: string }) {
  if (path === "/") return <HealthPage />;
  if (path === "/identity") return <Specimen />;
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-2 px-7 py-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="text-[15px] text-ink-2">
          Nothing lives at <code className="font-mono text-[13px]">{path}</code>. Try{" "}
          <a className="text-sel underline" href="/">
            the health page
          </a>
          .
        </p>
      </main>
    </div>
  );
}
