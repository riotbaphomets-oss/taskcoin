import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, feeFor, HOLD_DAYS, PLATFORM_EMAIL, REVIEW_DAYS } from "./config";
import { runTx, UserError } from "./tx";

// Genehmigt eine Einreichung und bucht: Worker-Anteil (mit Wartezeit) + Plattformgebühr.
// Reward = Worker-Anteil + Gebühr, das Escrow des Auftraggebers ist damit exakt aufgelöst.
export async function approveInTx(
  tx: Prisma.TransactionClient,
  submissionId: string,
  opts: { expectedClientId?: string; auto?: boolean } = {},
) {
  const sub = await tx.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  });
  if (!sub || (opts.expectedClientId && sub.campaign.clientId !== opts.expectedClientId)) {
    throw new UserError("Einreichung nicht gefunden.");
  }

  const updated = await tx.submission.updateMany({
    where: { id: submissionId, status: "SUBMITTED" },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  if (updated.count !== 1) throw new UserError("Diese Einreichung wurde schon bewertet.");

  const reward = sub.campaign.rewardCoins;
  const fee = feeFor(reward);
  const net = reward - fee;
  const now = new Date();
  const label = opts.auto ? "Automatisch freigegeben" : "Aufgabe";

  const workerWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: sub.workerId } });
  await tx.ledgerEntry.create({
    data: {
      walletId: workerWallet.id,
      amount: net,
      type: "EARNING",
      status: "PENDING",
      availableAt: addDays(now, HOLD_DAYS),
      note: `${label}: ${sub.campaign.title}`,
      campaignId: sub.campaignId,
    },
  });

  if (fee > 0) {
    const platform = await tx.user.upsert({
      where: { email: PLATFORM_EMAIL },
      update: {},
      create: {
        email: PLATFORM_EMAIL,
        name: "Plattform",
        passwordHash: "!",
        role: "ADMIN",
        disabled: true,
        wallet: { create: {} },
      },
    });
    const platformWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: platform.id } });
    await tx.ledgerEntry.create({
      data: {
        walletId: platformWallet.id,
        amount: fee,
        type: "FEE",
        note: `Gebühr: ${sub.campaign.title}`,
        campaignId: sub.campaignId,
      },
    });
  }
  return sub.campaignId;
}

// Genehmigt alle Einreichungen, die länger als REVIEW_DAYS offen sind. Jede in eigener Transaktion.
export async function autoApproveDue(): Promise<number> {
  const cutoff = new Date(Date.now() - REVIEW_DAYS * 86_400_000);
  const due = await prisma.submission.findMany({
    where: { status: "SUBMITTED", createdAt: { lte: cutoff } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let approved = 0;
  for (const s of due) {
    const r = await runTx((tx) => approveInTx(tx, s.id, { auto: true }));
    if (r.ok) approved++;
  }
  return approved;
}
