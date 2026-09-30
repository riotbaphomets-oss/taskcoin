import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCoins, getBalance } from "@/lib/wallet";

export default async function ClientPage() {
  const user = await requireUser("CLIENT");
  const [balance, campaigns] = await Promise.all([
    getBalance(user.id),
    prisma.campaign.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { submissions: { where: { status: { in: ["SUBMITTED", "APPROVED"] } } } } },
      },
    }),
  ]);

  return (
    <DashboardShell name={user.name} title="Deine Kampagnen">
      <div className="stats">
        <div className="panel stat"><b>{formatCoins(balance.available)}</b><span>Coins Guthaben</span></div>
      </div>
      <div className="section-head">
        <h2>Kampagnen</h2>
        <div className="actions-row">
          <Link href="/client/wallet" className="btn btn-ghost">Wallet und Coins kaufen</Link>
          <Link href="/client/new" className="btn btn-coin">Kampagne erstellen</Link>
        </div>
      </div>
      {campaigns.length === 0 ? (
        <div className="empty">
          <h2>Noch keine Kampagne</h2>
          <p>Lege deine erste Kampagne an und bestimme, wie viel jede Aufgabe kostet.</p>
        </div>
      ) : (
        <div className="list">
          {campaigns.map((c) => (
            <div className="item" key={c.id}>
              <Link href={`/client/campaigns/${c.id}`} className="title">
                <h3>{c.title}</h3>
                <p>{c._count.submissions} von {c.slots} Plätzen belegt, {formatCoins(c.rewardCoins)} Coins pro Aufgabe</p>
              </Link>
              <span className={`badge ${c.status === "ACTIVE" ? "ok" : ""}`}>
                {c.status === "ACTIVE" ? "Aktiv" : "Beendet"}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
