"use client";

import { useFormState, useFormStatus } from "react-dom";
import { runAutoApproveAction, type ActionState } from "@/app/actions/campaigns";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost" type="submit" disabled={pending}>
      {pending ? "Läuft …" : "Auto-Freigabe jetzt ausführen"}
    </button>
  );
}

export function AutoApproveForm() {
  const [state, action] = useFormState<ActionState, FormData>(
    (prev) => runAutoApproveAction(prev),
    undefined,
  );
  return (
    <form action={action}>
      {state?.message && <p className="note" role="status">{state.message}</p>}
      <Submit />
    </form>
  );
}
