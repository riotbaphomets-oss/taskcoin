"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitAction, type ActionState } from "@/app/actions/campaigns";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-coin" type="submit" disabled={pending}>
      {pending ? "Einen Moment …" : "Ergebnis einreichen"}
    </button>
  );
}

export function SubmitForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(submitAction, undefined);
  return (
    <form action={action} className="form-narrow">
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="field">
        <span>Deine Antwort</span>
        <textarea name="answer" required minLength={3} maxLength={2000} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Submit />
    </form>
  );
}
