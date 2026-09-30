"use client";

import { useFormState } from "react-dom";
import { grantCoinsAction, type ActionState } from "@/app/actions/campaigns";

export function GrantForm() {
  const [state, action] = useFormState<ActionState, FormData>(grantCoinsAction, undefined);
  return (
    <form action={action} className="form-narrow">
      <label className="field">
        <span>E-Mail des Nutzers</span>
        <input name="email" type="email" required />
      </label>
      <label className="field">
        <span>Coins</span>
        <input name="amount" type="number" min={1} max={1000000} step={1} required />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.message && <p className="note" role="status">{state.message}</p>}
      <button className="btn" type="submit">Coins gutschreiben</button>
    </form>
  );
}
