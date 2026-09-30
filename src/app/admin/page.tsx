import { markWithdrawalPaidAction, rejectWithdrawalAction, toggleKycAction } from "@/app/actions/payments";
import { AutoApproveForm } from "@/components/AutoApproveForm";
import { DashboardShell } from "@/components/DashboardShell";
import { GrantForm } from "@/components/GrantForm";
import { requireUser } from "@/lib/auth";
import { eur, PLATFORM_EMAIL } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatCoins } from "@/lib/wallet";

export default async function AdminPage() {
  const admin = await requireUser("ADMIN");
  const [workers, clients, users, fees, waiting, withdrawals] = await Promise.all([
    prisma.user.count({ where: { role: "WORKER" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.findMany({
      where: { email: { not: PLATFORM_EMAIL } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.ledgerEntry.aggregate({ where: { type: "FEE" }, _sum: { amount: true } }),
    prisma.submission.count({ where: { status: "SUBMITTED" } }),
    prisma.withdrawal.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true, kycVerified: true } } },
    }),
  ]);

  return (
    <DashboardShell name={admin.name} title="Verwaltung">
      <div className="stats">
        <div className="panel stat"><b>{workers}</b><span>Worker</span></div>
        <div className="panel stat"><b>{clients}</b><span>Auftraggeber</span></div>
        <div className="panel stat"><b>{formatCoins(fees._sum.amount ?? 0)}</b><span>Coins Plattformgebühren</span></div>
        <div className="panel stat"><b>{waiting}</b><span>Offene Einreichungen</span></div>
      </div>

      <div className="section-head"><h2>Offene Auszahlungen</h2></div>
      {withdrawals.length === 0 ? (
        <div className="empty"><h2>Keine offenen Auszahlungen</h2><p>Neue Anfragen erscheinen hier.</p></div>
      ) : (
        <div className="list">
          {withdrawals.map((w) => (
            <div className="item" key={w.id}>
              <div>
                <h3>{eur(w.amountCents)} an {w.payoutTarget}</h3>
                <p>
                  {w.user.name}, {formatCoins(w.coins)} Coins, {w.createdAt.toLocaleDateString("de-DE")}
                  {w.user.kycVerified ? ", Identität geprüft" : ", Identität nicht geprüft"}
                </p>
              </div>
              <div className="actions-row">
                <form action={markWithdrawalPaidAction}>
                  <input type="hidden" name="withdrawalId" value={w.id} />
                  <button className="btn btn-small" type="submit">Als bezahlt markieren</button>
                </form>
                <form action={rejectWithdrawalAction}>
                  <input type="hidden" name="withdrawalId" value={w.id} />
                  <button className="btn btn-small btn-ghost" type="submit">Ablehnen und zurückbuchen</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-head"><h2>Auto-Freigabe</h2></div>
      <p className="muted">Läuft im Betrieb per Cron-Aufruf. Hier kannst du sie zum Testen von Hand starten.</p>
      <AutoApproveForm />

      <div className="section-head"><h2>Test-Coins vergeben</h2></div>
      <GrantForm />

      <div className="section-head"><h2>Neueste Konten</h2></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Identität</th><th>Erstellt</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.disabled ? "Gesperrt" : "Aktiv"}</td>
                <td>
                  {u.role === "WORKER" ? (
                    <form action={toggleKycAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn btn-small btn-ghost" type="submit">
                        {u.kycVerified ? "Geprüft, zurücksetzen" : "Als geprüft markieren"}
                      </button>
                    </form>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{u.createdAt.toLocaleDateString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
