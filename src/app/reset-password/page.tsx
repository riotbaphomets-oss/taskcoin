import Link from "next/link";
import { ResetForm } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  return (
    <>
      <header className="topbar"><div className="wrap"><Logo /></div></header>
      <main className="wrap">
        <div className="auth">
          <h1>Neues Passwort</h1>
          {token ? (
            <ResetForm token={token} />
          ) : (
            <p className="error">Dieser Link ist unvollständig. <Link href="/forgot-password">Neuen Link anfordern</Link></p>
          )}
        </div>
      </main>
    </>
  );
}
