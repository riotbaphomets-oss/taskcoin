import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveSubmissionAction,
  closeCampaignAction,
  rejectSubmissionAction,
} from "@/app/actions/campaigns";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, REVIEW_DAYS } from "@/lib/config";
import { formatCoins } from "@/lib/wallet";

const LABEL = { SUBMITTED: "Offen", APPROVED: "Genehmigt", REJECTED: "Abgelehnt" } as const;

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const user = await requireUser("CLIENT");
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, clientId: user.id },
    include: {
      submissions: { orderBy: { createdAt: "desc" }, include: { worker: { select: { name: true } } } },
    },
  });
  if (!campaign) notFound();

  const used = campaign.submissions.filter((s) => s.status !== "REJECTED").length;

  return (
    <DashboardShell name={user.name} title={campaign.title}>
      <Link href="/client" className="back">Zurück zu deinen Kampagnen</Link>
      <div className="panel">
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{campaign.description}</p>
        <p>
          {formatCoins(campaign.rewardCoins)} Coins pro Aufgabe, {used} von {campaign.slots} Plätzen belegt.{" "}
          <span className={`badge ${campaign.status === "ACTIVE" ? "ok" : ""}`}>
            {campaign.status === "ACTIVE" ? "Aktiv" : "Beendet"}
          </span>
        </p>
        {campaign.status === "ACTIVE" && (
          <form action={closeCampaignAction} style={{ marginTop: 14 }}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button className="btn btn-ghost" type="submit">Kampagne beenden und freie Plätze zurückbuchen</button>
          </form>
        )}
      </div>

      <div className="section-head"><h2>Einreichungen</h2></div>
      <p className="muted">Einreichungen, die du nicht innerhalb von {REVIEW_DAYS} Tagen bewertest, werden automatisch genehmigt.</p>
      {campaign.submissions.length === 0 ? (
        <div className="empty"><h2>Noch keine Einreichungen</h2><p>Sobald Worker Ergebnisse senden, siehst du sie hier.</p></div>
      ) : (
        <div className="list">
          {campaign.submissions.map((s) => (
            <div className="item" key={s.id}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3>{s.worker.name}</h3>
                <p className="answer">{s.answer}</p>
                {s.status === "SUBMITTED" && (
                  <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    Automatische Genehmigung am {addDays(s.createdAt, REVIEW_DAYS).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>
              {s.status === "SUBMITTED" ? (
                <div className="actions-row">
                  <form action={approveSubmissionAction}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button className="btn btn-small" type="submit">Genehmigen</button>
                  </form>
                  <form action={rejectSubmissionAction}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button className="btn btn-small btn-ghost" type="submit">Ablehnen</button>
                  </form>
                </div>
              ) : (
                <span className={`badge ${s.status === "APPROVED" ? "ok" : "bad"}`}>{LABEL[s.status]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
