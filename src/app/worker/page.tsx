import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEE_PERCENT, HOLD_DAYS, netFor } from "@/lib/config";
import { formatCoins, getBalance } from "@/lib/wallet";

const LABEL = { SUBMITTED: "In Prüfung", APPROVED: "Genehmigt", REJECTED: "Abgelehnt" } as const;

export default async function WorkerPage() {
  const user = await requireUser("WORKER");
  const [balance, campaigns, mine] = await Promise.all([
    getBalance(user.id),
    prisma.campaign.findMany({
      where: { status: "ACTIVE", submissions: { none: { workerId: user.id } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { submissions: { where: { status: { in: ["SUBMITTED", "APPROVED"] } } } } },
      },
    }),
    prisma.submission.findMany({
      where: { workerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { campaign: { select: { title: true, rewardCoins: true } } },
    }),
  ]);
  const open = campaigns.filter((c) => c._count.submissions < c.slots);

  return (
    <DashboardShell name={user.name} title="Deine Aufgaben">
      <div className="stats">
        <div className="panel stat"><b>{formatCoins(balance.available)}</b><span>Coins verfügbar</span></div>
        <div className="panel stat"><b>{formatCoins(balance.pending)}</b><span>Coins in Wartezeit</span></div>
      </div>
      <p className="muted">
        Genehmigte Coins werden nach {HOLD_DAYS} Tagen verfügbar. Von jeder Aufgabe behält TaskCoin {FEE_PERCENT} %.
      </p>

      <p><Link href="/worker/wallet" className="btn btn-ghost">Wallet und Auszahlung</Link></p>
      <div className="section-head"><h2>Verfügbare Aufgaben</h2></div>
      {open.length === 0 ? (
        <div className="empty">
          <h2>Gerade keine Aufgaben frei</h2>
          <p>Schau später noch einmal vorbei. Neue Kampagnen erscheinen hier.</p>
        </div>
      ) : (
        <div className="list">
          {open.map((c) => (
            <div className="item" key={c.id}>
              <Link href={`/worker/campaigns/${c.id}`} className="title">
                <h3>{c.title}</h3>
                <p>Noch {c.slots - c._count.submissions} Plätze frei</p>
              </Link>
              <span className="badge ok">{formatCoins(netFor(c.rewardCoins))} Coins</span>
            </div>
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <>
          <div className="section-head"><h2>Deine Einreichungen</h2></div>
          <div className="list">
            {mine.map((s) => (
              <div className="item" key={s.id}>
                <div>
                  <h3>{s.campaign.title}</h3>
                  <p>{formatCoins(netFor(s.campaign.rewardCoins))} Coins</p>
                </div>
                <span className={`badge ${s.status === "APPROVED" ? "ok" : s.status === "REJECTED" ? "bad" : ""}`}>
                  {LABEL[s.status]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
