"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestWithdrawalAction } from "@/app/actions/payments";
import type { ActionState } from "@/app/actions/campaigns";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-coin" type="submit" disabled={pending}>
      {pending ? "Einen Moment …" : "Auszahlung anfragen"}
    </button>
  );
}

export function WithdrawForm({ min, coinsPerEuro }: { min: number; coinsPerEuro: number }) {
  const [state, action] = useFormState<ActionState, FormData>(requestWithdrawalAction, undefined);
  const [coins, setCoins] = useState(min);
  const euro = Number.isFinite(coins) ? Math.floor((coins * 100) / coinsPerEuro) / 100 : 0;

  return (
    <form action={action} className="form-narrow">
      <label className="field">
        <span>Coins</span>
        <input
          name="coins" type="number" min={min} step={1} required
          value={coins} onChange={(e) => setCoins(e.target.valueAsNumber)}
        />
      </label>
      <div className="total">Auszahlungsbetrag: <b>{euro.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</b></div>
      <label className="field">
        <span>PayPal-E-Mail</span>
        <input name="payoutTarget" type="email" autoComplete="email" required />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.message && <p className="note" role="status">{state.message}</p>}
      <Submit />
    </form>
  );
}
