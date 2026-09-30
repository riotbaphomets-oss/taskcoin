import Link from "next/link";
import { ForgotForm } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";

export default function ForgotPasswordPage() {
  return (
    <>
      <header className="topbar"><div className="wrap"><Logo /></div></header>
      <main className="wrap">
        <div className="auth">
          <h1>Passwort vergessen</h1>
          <p className="muted">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>
          <ForgotForm />
          <p className="auth-alt"><Link href="/login">Zurück zur Anmeldung</Link></p>
        </div>
      </main>
    </>
  );
}
