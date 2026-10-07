// Every way someone without an invite tries to make an account ends here (M4S.1). When learner
// accounts open, this component is deleted.
import { Link } from "react-router";
import { SECONDARY } from "../layout/buttons";
import { AuthCard } from "./AuthCard";

export function NotYet() {
  return (
    <AuthCard
      title="Learner accounts are coming"
      tag={
        <span className="self-start rounded-pill border border-border-2 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-2">
          Not open yet
        </span>
      }
      lead="You can’t create an account yet. Everything in Comeni Code works without one: routes, pages and questions are all here."
    >
      <p className="text-[14px] leading-relaxed text-ink-2">
        On the team? Open the link in your invite email.
      </p>
      <Link to="/" className={`${SECONDARY} self-start`}>
        Back to Start
      </Link>
    </AuthCard>
  );
}
