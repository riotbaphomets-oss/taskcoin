import Link from "next/link";
import { Logo } from "@/components/Logo";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
  const userId = await consumeAuthToken(searchParams.token, "VERIFY_EMAIL");
  if (userId) {
    await prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  return (
    <>
      <header className="topbar"><div className="wrap"><Logo /></div></header>
      <main className="wrap">
        <div className="auth">
          {userId ? (
            <>
              <h1>E-Mail bestätigt</h1>
              <p className="muted">Danke. Dein Konto ist jetzt freigeschaltet.</p>
              <Link href="/login" className="btn btn-coin">Weiter zur Anmeldung</Link>
            </>
          ) : (
            <>
              <h1>Link nicht gültig</h1>
              <p className="muted">
                Der Link ist abgelaufen oder wurde schon benutzt. Wenn du dein Konto bereits bestätigt hast,
                kannst du dich einfach anmelden. Sonst fordere nach der Anmeldung einen neuen Link an.
              </p>
              <Link href="/login" className="btn">Zur Anmeldung</Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
