// Resetting a password (M4S.3): ask for a link, then set the password from it. allauth mails
// nobody for an unknown address (M4.3), so the page says the same whoever asked.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { FormRefused, requestPasswordReset, resetPassword } from "../api/auth";
import { PRIMARY, SECONDARY } from "../layout/buttons";
import { ErrorNotice } from "../layout/ErrorNotice";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";

export function RequestResetPage() {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => requestPasswordReset(email) });
  const refused = send.error instanceof FormRefused ? send.error.byField : {};
  return (
    <AuthPage>
      <AuthCard title="Reset your password" lead="We’ll mail a link to set a new one.">
        {send.isSuccess ? (
          <p className="text-[14px] text-ink-2">
            If an account has that address, a link is on its way.
          </p>
        ) : (
          <form
            className="flex flex-col gap-[18px]"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              errors={refused.email}
            />
            <FormErrors errors={refused[""]} />
            {send.error !== null && !(send.error instanceof FormRefused) && (
              <ErrorNotice error={send.error} />
            )}
            <button type="submit" className={PRIMARY} disabled={send.isPending}>
              Send a link
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}

export function ResetPasswordPage() {
  const { key = "" } = useParams();
  const [password, setPassword] = useState("");
  const set = useMutation({ mutationFn: () => resetPassword(key, password) });
  const refused = set.error instanceof FormRefused ? set.error.byField : {};
  return (
    <AuthPage>
      <AuthCard title="Set a new password">
        {set.isSuccess ? (
          <>
            <p className="text-[14px] text-ink-2">Your password is set.</p>
            <Link to="/sign-in" className={`${SECONDARY} self-start`}>
              Sign in
            </Link>
          </>
        ) : (
          <form
            className="flex flex-col gap-[18px]"
            onSubmit={(event) => {
              event.preventDefault();
              set.mutate();
            }}
          >
            <Field
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              errors={refused.password}
              autoComplete="new-password"
            />
            <FormErrors errors={[...(refused.key ?? []), ...(refused[""] ?? [])]} />
            {set.error !== null && !(set.error instanceof FormRefused) && (
              <ErrorNotice error={set.error} />
            )}
            <button type="submit" className={PRIMARY} disabled={set.isPending}>
              Set the password
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}
