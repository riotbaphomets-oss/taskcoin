import Link from "next/link";
import { CampaignForm } from "@/components/CampaignForm";
import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { FEE_PERCENT } from "@/lib/config";
import { getBalance } from "@/lib/wallet";

export default async function NewCampaignPage() {
  const user = await requireUser("CLIENT");
  const balance = await getBalance(user.id);
  return (
    <DashboardShell name={user.name} title="Kampagne erstellen">
      <Link href="/client" className="back">Zurück zu deinen Kampagnen</Link>
      <p className="muted">Du zahlst genau den angezeigten Betrag. Der Worker erhält seinen Anteil abzüglich {FEE_PERCENT} % Plattformgebühr.</p>
      <CampaignForm balance={balance.available} />
    </DashboardShell>
  );
}
