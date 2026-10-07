// /sign-in/error, where allauth sends a provider sign-in it stopped (M4A.3). An account Code
// doesn't know is the same "not yet" as /join (M4S.1); anything else is named.
import { Link, useSearchParams } from "react-router";
import { SECONDARY } from "../layout/buttons";
import { AuthCard, AuthPage } from "./AuthCard";
import { NotYet } from "./NotYet";

export function SignInErrorPage() {
  const [params] = useSearchParams();
  const reason = params.get("error") ?? "no reason given";
  return (
    <AuthPage>
      {reason === "signup_closed" ? (
        <NotYet />
      ) : (
        <AuthCard
          title="Signing in didn’t finish"
          lead={`The provider’s sign-in stopped (${reason}). Try again, or use your email and password.`}
        >
          <Link to="/sign-in" className={`${SECONDARY} self-start`}>
            Back to Sign in
          </Link>
        </AuthCard>
      )}
    </AuthPage>
  );
}
