import Link from "next/link";
import { buyCoinsSimulatedAction } from "@/app/actions/payments";
import { DashboardShell } from "@/components/DashboardShell";
import { LedgerList } from "@/components/LedgerList";
import { requireUser } from "@/lib/auth";
import { COIN_PACKAGES, eur, paymentsSimulated } from "@/lib/config";
import { formatCoins, getBalance, recentEntries } from "@/lib/wallet";

export default async function ClientWallet() {
  const user = await requireUser("CLIENT");
  const [balance, entries] = await Promise.all([getBalance(user.id), recentEntries(user.id)]);
  const simulated = paymentsSimulated();

  return (
    <DashboardShell name={user.name} title="Wallet">
      <Link href="/client" className="back">Zurück zu deinen Kampagnen</Link>
      {simulated ? (
        <p className="banner">Testmodus: Käufe sind simuliert, es fließt kein echtes Geld.</p>
      ) : (
        <p className="banner">Coin-Käufe sind noch nicht aktiviert.</p>
      )}
      <div className="stats">
        <div className="panel stat"><b>{formatCoins(balance.available)}</b><span>Coins verfügbar</span></div>
      </div>

      {simulated && (
        <>
          <div className="section-head"><h2>Coins kaufen</h2></div>
          <div className="pkg-grid">
            {COIN_PACKAGES.map((p) => (
              <form key={p.id} action={buyCoinsSimulatedAction} className="panel pkg">
                <input type="hidden" name="packageId" value={p.id} />
                <b>{formatCoins(p.coins)} Coins</b>
                <span>{eur(p.cents)}</span>
                <button className="btn btn-small" type="submit">Testkauf</button>
              </form>
            ))}
          </div>
        </>
      )}

      <div className="section-head"><h2>Buchungen</h2></div>
      <LedgerList entries={entries} />
    </DashboardShell>
  );
}
