import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { LedgerList } from "@/components/LedgerList";
import { WithdrawForm } from "@/components/WithdrawForm";
import { requireUser } from "@/lib/auth";
import {
  COINS_PER_EURO,
  eur,
  KYC_THRESHOLD_COINS,
  MIN_PAYOUT_COINS,
  paymentsSimulated,
} from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatCoins, getBalance, recentEntries } from "@/lib/wallet";

const LABEL = { REQUESTED: "In Prüfung", PAID: "Ausgezahlt", REJECTED: "Abgelehnt" } as const;

export default async function WorkerWallet() {
  const user = await requireUser("WORKER");
  const [balance, entries, withdrawals] = await Promise.all([
    getBalance(user.id),
    recentEntries(user.id),
    prisma.withdrawal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const simulated = paymentsSimulated();

  return (
    <DashboardShell name={user.name} title="Wallet">
      <Link href="/worker" className="back">Zurück zu den Aufgaben</Link>
      {simulated ? (
        <p className="banner">Testmodus: Auszahlungen sind simuliert, es fließt kein echtes Geld.</p>
      ) : (
        <p className="banner">Auszahlungen sind noch nicht aktiviert.</p>
      )}
      <div className="stats">
        <div className="panel stat"><b>{formatCoins(balance.available)}</b><span>Coins verfügbar</span></div>
        <div className="panel stat"><b>{formatCoins(balance.pending)}</b><span>Coins in Wartezeit</span></div>
        <div className="panel stat"><b>{eur(Math.floor((balance.available * 100) / COINS_PER_EURO))}</b><span>Wert der verfügbaren Coins</span></div>
      </div>

      {simulated && (
        <>
          <div className="section-head"><h2>Auszahlung</h2></div>
          <p className="muted">
            {formatCoins(COINS_PER_EURO)} Coins sind 1 €. Mindestbetrag {formatCoins(MIN_PAYOUT_COINS)} Coins.
            Über {formatCoins(KYC_THRESHOLD_COINS)} Coins ist eine Identitätsprüfung nötig
            {user.kycVerified ? " (bei dir erledigt)." : "."}
          </p>
          <WithdrawForm min={MIN_PAYOUT_COINS} coinsPerEuro={COINS_PER_EURO} />
        </>
      )}

      {withdrawals.length > 0 && (
        <>
          <div className="section-head"><h2>Deine Auszahlungen</h2></div>
          <div className="list">
            {withdrawals.map((w) => (
              <div className="item" key={w.id}>
                <div>
                  <h3>{eur(w.amountCents)}</h3>
                  <p>{formatCoins(w.coins)} Coins, {w.createdAt.toLocaleDateString("de-DE")}</p>
                </div>
                <span className={`badge ${w.status === "PAID" ? "ok" : w.status === "REJECTED" ? "bad" : ""}`}>
                  {LABEL[w.status]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head"><h2>Buchungen</h2></div>
      <LedgerList entries={entries} />
    </DashboardShell>
  );
}
