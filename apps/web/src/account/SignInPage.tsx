// L14 · Sign in (M4.8a spec, M4S.1–M4S.2): providers first, then email and password.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FormRefused, signIn } from "../api/auth";
import { useAuthChange } from "../api/queries";
import { PRIMARY } from "../layout/buttons";
import { ErrorNotice } from "../layout/ErrorNotice";
import { AuthCard, AuthPage, FormErrors } from "./AuthCard";
import { Field } from "./Field";
import { safeNext } from "./next";
import { ProviderButtons } from "./ProviderButtons";

export function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const changed = useAuthChange();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = useMutation({
    mutationFn: () => signIn(email, password),
    onSuccess: async () => {
      await changed();
      navigate(next);
    },
  });
  const refused = submit.error instanceof FormRefused ? submit.error.byField : {};

  return (
    <AuthPage>
      <AuthCard
        title="Sign in"
        lead="to keep your routes and what you know, and to open Studio if you’re on the team."
      >
        <ProviderButtons next={next} rule="after" />
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate();
          }}
        >
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            errors={refused.email}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            errors={refused.password}
            autoComplete="current-password"
          />
          <Link to="/reset-password" className="-mt-2 self-end text-[13px] text-sel">
            Forgot your password?
          </Link>
          <FormErrors errors={refused[""]} />
          {submit.error !== null && !(submit.error instanceof FormRefused) && (
            <ErrorNotice error={submit.error} />
          )}
          <button type="submit" className={PRIMARY} disabled={submit.isPending}>
            Sign in
          </button>
        </form>
        <p className="text-center text-[13.5px] text-ink-2">
          New here?{" "}
          <Link to="/join" className="text-sel">
            Create an account
          </Link>
        </p>
      </AuthCard>
    </AuthPage>
  );
}
