"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction, registerAction, type FormState } from "@/app/actions/auth";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Einen Moment …" : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [state, action] = useFormState<FormState, FormData>(
    isRegister ? registerAction : loginAction,
    undefined,
  );

  return (
    <div className="auth">
      <h1>{isRegister ? "Konto erstellen" : "Anmelden"}</h1>
      <form action={action}>
        {isRegister && (
          <>
            <fieldset className="choice">
              <legend>Ich möchte …</legend>
              <label>
                <input type="radio" name="role" value="WORKER" defaultChecked /> Aufgaben erledigen
                <small>Coins verdienen</small>
              </label>
              <label>
                <input type="radio" name="role" value="CLIENT" /> Aufgaben einstellen
                <small>Kampagnen starten</small>
              </label>
            </fieldset>
            <label className="field">
              <span>Name</span>
              <input name="name" autoComplete="name" required minLength={2} maxLength={60} />
            </label>
          </>
        )}
        <label className="field">
          <span>E-Mail</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 10 : undefined}
          />
        </label>
        {state?.error && <p className="error" role="alert">{state.error}</p>}
        <Submit label={isRegister ? "Konto erstellen" : "Anmelden"} />
        {!isRegister && (
          <p className="auth-alt"><Link href="/forgot-password">Passwort vergessen?</Link></p>
        )}
      </form>
      <p className="auth-alt">
        {isRegister ? (
          <>Schon ein Konto? <Link href="/login">Anmelden</Link></>
        ) : (
          <>Noch kein Konto? <Link href="/register">Registrieren</Link></>
        )}
      </p>
    </div>
  );
}
