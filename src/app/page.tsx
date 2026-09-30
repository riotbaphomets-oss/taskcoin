import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <div className="topbar-right">
            <Link href="/login">Anmelden</Link>
          </div>
        </div>
      </header>
      <main className="wrap">
        <section className="hero">
          <h1>Aufgaben erledigen. Coins verdienen.</h1>
          <p>
            TaskCoin verbindet Menschen, die kleine Online-Aufgaben erledigen, mit Auftraggebern,
            die echtes Feedback brauchen.
          </p>
          <div className="actions">
            <Link href="/register" className="btn btn-coin">Kostenlos starten</Link>
            <Link href="/login" className="btn btn-ghost">Anmelden</Link>
          </div>
        </section>
        <section className="roles">
          <div className="panel">
            <h2>Für Worker</h2>
            <p>Such dir Aufgaben aus, erledige sie und sammle Coins in deinem Wallet.</p>
          </div>
          <div className="panel">
            <h2>Für Auftraggeber</h2>
            <p>Lege eine Kampagne an, bestimme den Preis pro Aufgabe und erhalte geprüfte Ergebnisse.</p>
          </div>
        </section>
      </main>
    </>
  );
}
