import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { ResendForm } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";
import { requireSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function VerifyPendingPage() {
  const user = await requireSessionUser();
  if (user.emailVerifiedAt) redirect(homeFor(user.role));

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <div className="topbar-right">
            <form action={logoutAction}>
              <button className="btn btn-ghost" type="submit">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="auth">
          <h1>E-Mail bestätigen</h1>
          <p className="muted">
            Wir haben einen Link an <b>{user.email}</b> geschickt. Sobald du ihn geöffnet hast, lade diese Seite neu.
            Schau auch im Spam-Ordner nach.
          </p>
          <ResendForm />
        </div>
      </main>
    </>
  );
}
