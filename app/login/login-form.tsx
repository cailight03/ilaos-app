"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex min-h-14 items-center gap-3 rounded-xl border border-separator bg-card px-3.5 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand text-white">
          <Lock className="size-4" aria-hidden />
        </span>
        <label htmlFor="pin" className="sr-only">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]*"
          placeholder="PIN"
          required
          autoFocus
          className="h-14 min-w-0 flex-1 bg-transparent text-[20px] tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-label2/60"
        />
      </div>
      {state.error && (
        <p role="alert" className="px-1 text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 disabled:active:scale-100"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
