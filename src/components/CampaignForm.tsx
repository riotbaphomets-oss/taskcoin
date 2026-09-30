"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createCampaignAction, type ActionState } from "@/app/actions/campaigns";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Einen Moment …" : "Kampagne starten"}
    </button>
  );
}

export function CampaignForm({ balance }: { balance: number }) {
  const [state, action] = useFormState<ActionState, FormData>(createCampaignAction, undefined);
  const [reward, setReward] = useState(100);
  const [slots, setSlots] = useState(10);
  const total = (Number.isFinite(reward) ? reward : 0) * (Number.isFinite(slots) ? slots : 0);
  const fmt = (n: number) => n.toLocaleString("de-DE");

  return (
    <form action={action} className="form-narrow">
      <label className="field">
        <span>Titel</span>
        <input name="title" required minLength={3} maxLength={80} />
      </label>
      <label className="field">
        <span>Was sollen Worker tun und einreichen?</span>
        <textarea name="description" required minLength={10} maxLength={1500} />
      </label>
      <label className="field">
        <span>Coins pro erledigter Aufgabe</span>
        <input
          name="rewardCoins" type="number" min={1} max={100000} step={1} required
          value={reward} onChange={(e) => setReward(e.target.valueAsNumber)}
        />
      </label>
      <label className="field">
        <span>Anzahl Plätze</span>
        <input
          name="slots" type="number" min={1} max={10000} step={1} required
          value={slots} onChange={(e) => setSlots(e.target.valueAsNumber)}
        />
      </label>
      <div className="total">
        Gesamtbudget: <b>{fmt(total)} Coins</b>
        <br />
        Dein Guthaben: {fmt(balance)} Coins. Das Budget wird beim Start gesperrt.
      </div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Submit />
    </form>
  );
}
