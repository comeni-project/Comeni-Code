// The paths the app answers (M3 part 3 spec, M3P3.2). Part 4 adds /route, part 5 /node/:id.
import { Route, Routes, useLocation } from "react-router";
import { JoinPage } from "./account/JoinPage";
import { RequestResetPage, ResetPasswordPage } from "./account/ResetPassword";
import { SignInErrorPage } from "./account/SignInErrorPage";
import { SignInPage } from "./account/SignInPage";
import { HealthPage } from "./health/HealthPage";
import { Specimen } from "./identity/Specimen";
import { TopBar } from "./layout/TopBar";
import { NodePage } from "./node/NodePage";
import { RoutePage } from "./route/RoutePage";
import { StartPage } from "./start/StartPage";
import { DraftsPage } from "./studio/drafts/DraftsPage";
import { StudioHome } from "./studio/StudioHome";
import { StudioShell } from "./studio/StudioShell";
import { TeamPage } from "./studio/team/TeamPage";

function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-2 px-7 py-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="text-[15px] text-ink-2">
          Nothing lives at <code className="font-mono text-[13px]">{pathname}</code>. Try{" "}
          <a className="text-sel underline" href="/">
            the Start page
          </a>
          .
        </p>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/route" element={<RoutePage />} />
      <Route path="/node/:id" element={<NodePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-in/error" element={<SignInErrorPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/reset-password" element={<RequestResetPage />} />
      <Route path="/reset-password/:key" element={<ResetPasswordPage />} />
      <Route path="/studio" element={<StudioShell />}>
        <Route index element={<StudioHome />} />
        <Route path="drafts" element={<DraftsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="*" element={<p className="text-[15px] text-ink-2">Nothing lives here.</p>} />
      </Route>
      <Route path="/health" element={<HealthPage />} />
      <Route path="/identity" element={<Specimen />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
