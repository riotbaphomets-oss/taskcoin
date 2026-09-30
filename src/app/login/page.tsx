import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage({ searchParams }: { searchParams: { reset?: string } }) {
  return (
    <>
      <header className="topbar"><div className="wrap"><Logo /></div></header>
      <main className="wrap">
        {searchParams.reset && (
          <p className="banner" role="status" style={{ maxWidth: 420, margin: "32px auto 0" }}>
            Dein Passwort wurde geändert. Bitte melde dich neu an.
          </p>
        )}
        <AuthForm mode="login" />
      </main>
    </>
  );
}
