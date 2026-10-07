// An invite opened while signed in: allauth signs up only the signed-out, so this says who is
// signed in and comes back to the invite after signing out.
import { useMutation } from "@tanstack/react-query";
import { signOut } from "../api/auth";
import { SECONDARY } from "../layout/buttons";
import { ErrorNotice } from "../layout/ErrorNotice";
import { leave } from "../layout/leave";
import { AuthCard } from "./AuthCard";

export function SignOutFirst({ email, back }: { email: string; back: string }) {
  const out = useMutation({ mutationFn: signOut, onSuccess: () => leave(back) });
  return (
    <AuthCard
      title="Join the Studio team"
      lead={`You’re signed in as ${email}. Sign out to accept this invite.`}
    >
      {out.error !== null && <ErrorNotice error={out.error} />}
      <button
        type="button"
        className={`${SECONDARY} self-start`}
        disabled={out.isPending}
        onClick={() => out.mutate()}
      >
        Sign out
      </button>
    </AuthCard>
  );
}
