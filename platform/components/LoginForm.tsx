"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { fr } from "@/lib/i18n/fr";

const initial: LoginState = { error: null, email: "" };
const fieldClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form
      action={action}
      className="flex w-full max-w-sm flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {fr.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={state.email}
          autoComplete="username"
          required
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {fr.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </div>
      {state.error && (
        <p
          role="alert"
          data-testid="login-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {fr.auth[state.error]}
        </p>
      )}
      <Link
        href="/mot-de-passe-oublie"
        className="-mt-2 self-end text-sm text-slate-700 underline"
      >
        {fr.email.forgotLink}
      </Link>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? fr.auth.submitting : fr.auth.submit}
      </button>
    </form>
  );
}
