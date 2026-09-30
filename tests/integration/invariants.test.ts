import { beforeEach, describe, expect, it } from "vitest";
import { addDays, REVIEW_DAYS } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  approveSubmission,
  closeCampaign,
  createCampaign,
  markWithdrawalPaid,
  rejectSubmission,
  rejectWithdrawal,
  requestWithdrawal,
  submitWork,
} from "@/lib/money";
import { autoApproveDue } from "@/lib/payout";
import { getBalance } from "@/lib/wallet";
import { addLedger, campaignSum, expectOk, makeUser, resetDb } from "../helpers";

beforeEach(resetDb);

// Kern-Regel der Plattform: Coins entstehen nur durch Einzahlung/Gutschrift und verschwinden nur durch Auszahlung.
// Alles dazwischen (Escrow, Verdienst, Gebühr, Rückbuchung) muss sich pro Kampagne auf genau 0 aufheben.
describe("Buchhaltung geht immer auf", () => {
  it("nach einem kompletten Durchlauf mit Genehmigen, Ablehnen, Auto-Freigabe, Beenden und Auszahlungen", async () => {
    const client = await makeUser("CLIENT", { coins: 100_000 });
    const [w1, w2, w3] = await Promise.all([makeUser("WORKER"), makeUser("WORKER"), makeUser("WORKER")]);

    const desc = "Eine Beschreibung mit genug Zeichen.";
    const A = expectOk(await createCampaign(client.id, { title: "A", description: desc, rewardCoins: 1000, slots: 3 }));
    const B = expectOk(await createCampaign(client.id, { title: "B", description: desc, rewardCoins: 777, slots: 4 }));

    // Kampagne A: w1 genehmigt, w2 abgelehnt, w3 läuft in die Auto-Freigabe
    const a1 = expectOk(await submitWork(w1.id, A, "x"));
    const a2 = expectOk(await submitWork(w2.id, A, "x"));
    const a3 = expectOk(await submitWork(w3.id, A, "x"));
    expectOk(await approveSubmission(client.id, a1));
    expectOk(await rejectSubmission(client.id, a2));
    await prisma.submission.update({ where: { id: a3 }, data: { createdAt: addDays(new Date(), -(REVIEW_DAYS + 1)) } });
    expect(await autoApproveDue()).toBe(1);

    // Kampagne B: zwei genehmigt (krumme Belohnung 777 testet das Runden der Gebühr)
    const b1 = expectOk(await submitWork(w1.id, B, "x"));
    const b2 = expectOk(await submitWork(w2.id, B, "x"));
    expectOk(await approveSubmission(client.id, b1));
    expectOk(await approveSubmission(client.id, b2));

    expectOk(await closeCampaign(client.id, A));
    expectOk(await closeCampaign(client.id, B));

    // Wartezeit vorbei, dann Auszahlungen: eine bezahlt, eine abgelehnt
    await prisma.ledgerEntry.updateMany({ where: { type: "EARNING" }, data: { availableAt: new Date(Date.now() - 1000) } });
    await addLedger(w1.wallet!.id, 10_000, "ADJUSTMENT");
    await addLedger(w2.wallet!.id, 10_000, "ADJUSTMENT");
    const p1 = expectOk(await requestWithdrawal(w1.id, 10_000, "a@test.local"));
    const p2 = expectOk(await requestWithdrawal(w2.id, 10_000, "b@test.local"));
    expectOk(await markWithdrawalPaid(p1));
    expectOk(await rejectWithdrawal(p2));

    // 1) Jede beendete Kampagne hebt sich exakt auf
    expect(await campaignSum(A)).toBe(0);
    expect(await campaignSum(B)).toBe(0);

    // 2) Gesamt: Einzahlungen und Gutschriften minus tatsächlich Ausgezahltes
    const sum = async (types: string[]) =>
      (await prisma.ledgerEntry.aggregate({ where: { type: { in: types as never[] } }, _sum: { amount: true } }))._sum.amount ?? 0;
    const total = (await prisma.ledgerEntry.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0;
    const inflow = await sum(["DEPOSIT", "ADJUSTMENT"]);
    const payouts = await sum(["WITHDRAWAL", "WITHDRAWAL_REVERSAL"]);
    expect(total).toBe(inflow + payouts);

    // 3) Kein Konto hat negatives Guthaben
    for (const wallet of await prisma.wallet.findMany()) {
      const b = await getBalance(wallet.userId);
      expect(b.available).toBeGreaterThanOrEqual(0);
      expect(b.pending).toBeGreaterThanOrEqual(0);
    }
  });
});
