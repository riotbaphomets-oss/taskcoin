"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/app/actions/account";
import type { ActionState } from "@/app/actions/campaigns";

function Submit({ label, ghost }: { label: string; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${ghost ? "btn-ghost" : ""}`} type="submit" disabled={pending}>
      {pending ? "Einen Moment …" : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.message && <p className="note" role="status">{state.message}</p>}
    </>
  );
}

export function ForgotForm() {
  const [state, action] = useFormState<ActionState, FormData>(forgotPasswordAction, undefined);
  return (
    <form action={action}>
      <label className="field">
        <span>E-Mail</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <Feedback state={state} />
      <Submit label="Link anfordern" />
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useFormState<ActionState, FormData>(resetPasswordAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <label className="field">
        <span>Neues Passwort</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="field">
        <span>Passwort wiederholen</span>
        <input name="passwordRepeat" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <Feedback state={state} />
      <Submit label="Passwort speichern" />
    </form>
  );
}

export function ResendForm() {
  const [state, action] = useFormState<ActionState, FormData>(
    (prev) => resendVerificationAction(prev),
    undefined,
  );
  return (
    <form action={action}>
      <Feedback state={state} />
      <Submit label="E-Mail erneut senden" ghost />
    </form>
  );
}
