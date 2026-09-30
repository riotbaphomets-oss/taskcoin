import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { SubmitForm } from "@/components/SubmitForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEE_PERCENT, HOLD_DAYS, netFor } from "@/lib/config";
import { formatCoins } from "@/lib/wallet";

export default async function WorkerCampaign({ params }: { params: { id: string } }) {
  const user = await requireUser("WORKER");
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      submissions: { where: { workerId: user.id }, select: { id: true } },
      _count: { select: { submissions: { where: { status: { in: ["SUBMITTED", "APPROVED"] } } } } },
    },
  });
  if (!campaign) notFound();

  const alreadySent = campaign.submissions.length > 0;
  const full = campaign._count.submissions >= campaign.slots;
  const available = campaign.status === "ACTIVE" && !alreadySent && !full;

  return (
    <DashboardShell name={user.name} title={campaign.title}>
      <Link href="/worker" className="back">Zurück zu den Aufgaben</Link>
      <div className="panel" style={{ marginBottom: 20 }}>
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{campaign.description}</p>
        <span className="badge ok">{formatCoins(netFor(campaign.rewardCoins))} Coins</span>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Das ist dein Anteil nach {FEE_PERCENT} % Gebühr. Nach der Genehmigung dauert es {HOLD_DAYS} Tage, bis die Coins verfügbar sind.
        </p>
      </div>
      {available ? (
        <SubmitForm campaignId={campaign.id} />
      ) : (
        <div className="empty">
          <h2>{alreadySent ? "Du hast diese Aufgabe schon eingereicht" : "Diese Aufgabe ist nicht mehr verfügbar"}</h2>
          <p>{alreadySent ? "Den Status siehst du auf deiner Aufgabenseite." : "Alle Plätze sind vergeben oder die Kampagne ist beendet."}</p>
        </div>
      )}
    </DashboardShell>
  );
}
