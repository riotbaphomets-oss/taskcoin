import "server-only";
import { COIN_PACKAGES, KYC_THRESHOLD_COINS, MIN_PAYOUT_COINS, payoutCents } from "./config";
import { approveInTx } from "./payout";
import { completePurchaseInTx } from "./payments";
import { runTx, UserError } from "./tx";
import { balanceInTx, formatCoins } from "./wallet";

// Die gesamte Geld-Logik. Die Server Actions prüfen nur Anmeldung und Eingaben und rufen dann
// diese Funktionen auf. So lässt sich alles ohne Browser testen.

const isPositiveInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1;

export type CampaignInput = {
  title: string;
  description: string;
  rewardCoins: number;
  slots: number;
};

export function createCampaign(userId: string, input: CampaignInput) {
  const { title, description, rewardCoins, slots } = input;
  return runTx(async (tx) => {
    if (!isPositiveInt(rewardCoins) || !isPositiveInt(slots)) {
      throw new UserError("Coins und Plätze müssen ganze Zahlen ab 1 sein.");
    }
    const total = rewardCoins * slots;
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    const balance = await balanceInTx(tx, wallet.id);
    if (balance < total) {
      throw new UserError(
        `Dein Guthaben reicht nicht. Die Kampagne kostet ${formatCoins(total)} Coins, du hast ${formatCoins(balance)}.`,
      );
    }
    const campaign = await tx.campaign.create({
      data: { clientId: userId, title, description, rewardCoins, slots },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        amount: -total,
        type: "ESCROW_LOCK",
        note: `Kampagne: ${title}`,
        campaignId: campaign.id,
      },
    });
    return campaign.id;
  });
}

export function closeCampaign(userId: string, campaignId: string) {
  return runTx(async (tx) => {
    const campaign = await tx.campaign.findFirst({ where: { id: campaignId, clientId: userId } });
    if (!campaign) throw new UserError("Kampagne nicht gefunden.");

    const closed = await tx.campaign.updateMany({
      where: { id: campaignId, clientId: userId, status: "ACTIVE" },
      data: { status: "CLOSED" },
    });
    if (closed.count !== 1) throw new UserError("Die Kampagne ist schon beendet.");

    // Nicht vergebene Plätze zurückbuchen. Offene Einreichungen bleiben abgesichert.
    const used = await tx.submission.count({
      where: { campaignId, status: { in: ["SUBMITTED", "APPROVED"] } },
    });
    const refund = campaign.rewardCoins * (campaign.slots - used);
    if (refund > 0) {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amount: refund,
          type: "ESCROW_RELEASE",
          note: `Rückbuchung: ${campaign.title}`,
          campaignId,
        },
      });
    }
    return refund;
  });
}

export function submitWork(userId: string, campaignId: string, answer: string) {
  return runTx(async (tx) => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== "ACTIVE") {
      throw new UserError("Diese Aufgabe ist nicht mehr verfügbar.");
    }
    const existing = await tx.submission.findUnique({
      where: { campaignId_workerId: { campaignId, workerId: userId } },
    });
    if (existing) throw new UserError("Du hast diese Aufgabe schon eingereicht.");

    const used = await tx.submission.count({
      where: { campaignId, status: { in: ["SUBMITTED", "APPROVED"] } },
    });
    if (used >= campaign.slots) throw new UserError("Alle Plätze sind vergeben.");

    const submission = await tx.submission.create({ data: { campaignId, workerId: userId, answer } });
    return submission.id;
  });
}

// Gibt die Kampagnen-ID zurück (für das Neuladen der Seite).
export function approveSubmission(clientId: string, submissionId: string) {
  return runTx((tx) => approveInTx(tx, submissionId, { expectedClientId: clientId }));
}

export function rejectSubmission(clientId: string, submissionId: string) {
  return runTx(async (tx) => {
    const sub = await tx.submission.findUnique({
      where: { id: submissionId },
      include: { campaign: true },
    });
    if (!sub || sub.campaign.clientId !== clientId) throw new UserError("Einreichung nicht gefunden.");

    const updated = await tx.submission.updateMany({
      where: { id: submissionId, status: "SUBMITTED" },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserError("Diese Einreichung wurde schon bewertet.");

    if (sub.campaign.status === "CLOSED") {
      // Kampagne schon beendet: der frei gewordene Platz geht zurück an den Auftraggeber.
      const clientWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: clientId } });
      await tx.ledgerEntry.create({
        data: {
          walletId: clientWallet.id,
          amount: sub.campaign.rewardCoins,
          type: "ESCROW_RELEASE",
          note: `Rückbuchung: ${sub.campaign.title}`,
          campaignId: sub.campaignId,
        },
      });
    }
    return sub.campaignId;
  });
}

export function buyCoins(userId: string, packageId: string) {
  return runTx(async (tx) => {
    const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new UserError("Unbekanntes Paket.");
    const purchase = await tx.coinPurchase.create({
      data: { userId, coins: pkg.coins, amountCents: pkg.cents, provider: "simulated" },
    });
    await completePurchaseInTx(tx, purchase.id);
    return purchase.id;
  });
}

export function requestWithdrawal(userId: string, coins: number, payoutTarget: string) {
  return runTx(async (tx) => {
    if (!isPositiveInt(coins)) throw new UserError("Bitte gib eine ganze Zahl an.");
    if (coins < MIN_PAYOUT_COINS) {
      throw new UserError(`Die Mindestauszahlung beträgt ${formatCoins(MIN_PAYOUT_COINS)} Coins.`);
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (coins > KYC_THRESHOLD_COINS && !user.kycVerified) {
      throw new UserError(
        `Für Auszahlungen über ${formatCoins(KYC_THRESHOLD_COINS)} Coins brauchen wir zuerst eine Identitätsprüfung.`,
      );
    }
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const balance = await balanceInTx(tx, wallet.id);
    if (balance < coins) {
      throw new UserError(`Dein verfügbares Guthaben reicht nicht: ${formatCoins(balance)} Coins.`);
    }
    const withdrawal = await tx.withdrawal.create({
      data: { userId, coins, amountCents: payoutCents(coins), payoutTarget },
    });
    await tx.ledgerEntry.create({
      data: { walletId: wallet.id, amount: -coins, type: "WITHDRAWAL", note: "Auszahlung angefragt" },
    });
    return withdrawal.id;
  });
}

export function markWithdrawalPaid(withdrawalId: string) {
  return runTx(async (tx) => {
    const updated = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: "REQUESTED" },
      data: { status: "PAID", processedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserError("Diese Auszahlung wurde schon bearbeitet.");
  });
}

export function rejectWithdrawal(withdrawalId: string) {
  return runTx(async (tx) => {
    const w = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new UserError("Auszahlung nicht gefunden.");
    const updated = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: "REQUESTED" },
      data: { status: "REJECTED", processedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserError("Diese Auszahlung wurde schon bearbeitet.");

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: w.userId } });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        amount: w.coins,
        type: "WITHDRAWAL_REVERSAL",
        note: "Auszahlung abgelehnt, Coins zurückgebucht",
      },
    });
  });
}

export function grantCoins(email: string, amount: number) {
  return runTx(async (tx) => {
    if (!isPositiveInt(amount)) throw new UserError("Der Betrag muss eine ganze Zahl ab 1 sein.");
    const target = await tx.user.findUnique({ where: { email }, include: { wallet: true } });
    if (!target?.wallet) throw new UserError("Kein Nutzer mit dieser E-Mail-Adresse.");
    await tx.ledgerEntry.create({
      data: {
        walletId: target.wallet.id,
        amount,
        type: "ADJUSTMENT",
        note: "Test-Guthaben durch Admin",
      },
    });
    return target.email;
  });
}
