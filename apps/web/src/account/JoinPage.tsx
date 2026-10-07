// L15 · Join (M4.8a spec, M4S.1): with an invite, an account on the invite's address; without
// one, not yet; signed in, sign out first. Accepting holds the invite in the session first, so
// sign-up can take it (M4A.2).
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { acceptInvite, ROLE_LABEL, type Role } from "../api/accounts";
import { FormRefused, signUp } from "../api/auth";
import { useAuthChange, useInvite, useMe } from "../api/queries";
import { PRIMARY } from "../layout/buttons";
import { ErrorNotice } from "../layout/ErrorNotice";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";
import { NotYet } from "./NotYet";
import { ProviderButtons } from "./ProviderButtons";
import { SignOutFirst } from "./SignOutFirst";

export function JoinPage() {
  const { token } = useParams();
  const signedIn = useMe().data?.user ?? null;
  let inside = <NotYet />;
  if (token !== undefined && signedIn !== null) {
    inside = <SignOutFirst email={signedIn.email} back={`/join/${token}`} />;
  } else if (token !== undefined) {
    inside = <Invited token={token} />;
  }
  return <AuthPage>{inside}</AuthPage>;
}

function Invited({ token }: { token: string }) {
  const invite = useInvite(token);
  const navigate = useNavigate();
  const changed = useAuthChange();
  const [password, setPassword] = useState("");
  const join = useMutation({
    mutationFn: async (email: string) => {
      await acceptInvite(token);
      await signUp(email, password);
    },
    onSuccess: async () => {
      await changed();
      navigate("/studio");
    },
  });

  if (invite.isPending) return <p className="text-[15px] text-ink-2">Loading the invite…</p>;
  if (invite.isError) {
    return (
      <AuthCard title="This invite can’t be used">
        <ErrorNotice error={invite.error} />
      </AuthCard>
    );
  }
  const { email, role } = invite.data;
  const label = (ROLE_LABEL[role as Role] ?? role).toLowerCase();
  const refused = join.error instanceof FormRefused ? join.error.byField : {};

  return (
    <AuthCard
      title="Join the Studio team"
      tag={
        <span className="self-start rounded-pill bg-sel-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-sel">
          Invite · {label}
        </span>
      }
      lead={`You’re invited to Comeni Code’s Studio as ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}. The invite works once.`}
    >
      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(event) => {
          event.preventDefault();
          join.mutate(email);
        }}
      >
        <Field
          label="Email"
          type="email"
          value={email}
          locked
          hint="The address the invite was sent to."
          errors={refused.email}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          errors={refused.password}
          autoComplete="new-password"
        />
        <FormErrors errors={refused[""]} />
        {join.error !== null && !(join.error instanceof FormRefused) && (
          <ErrorNotice error={join.error} />
        )}
        <button type="submit" className={PRIMARY} disabled={join.isPending}>
          Create your account
        </button>
      </form>
      <ProviderButtons
        next="/studio"
        prepare={() => acceptInvite(token)}
        rule="before"
        note="With a provider, your account still takes the invite’s address."
      />
    </AuthCard>
  );
}
