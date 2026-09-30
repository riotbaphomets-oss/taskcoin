import { beforeEach, describe, expect, it } from "vitest";
import { addDays, HOLD_DAYS, REVIEW_DAYS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { approveSubmission, closeCampaign, rejectSubmission, submitWork } from "@/lib/money";
import { autoApproveDue } from "@/lib/payout";
import { getBalance } from "@/lib/wallet";
import { campaignSum, countLedger, expectFail, expectOk, makeUser, resetDb, setupCampaign } from "../helpers";

beforeEach(resetDb);

async function workerSubmits(campaignId: string, answer = "Antwort") {
  const worker = await makeUser("WORKER");
  const submissionId = expectOk(await submitWork(worker.id, campaignId, answer));
  return { worker, submissionId };
}

describe("Genehmigen", () => {
  it("zahlt Worker-Anteil mit Wartezeit und bucht die Gebühr", async () => {
    const { client, campaignId } = await setupCampaign({ reward: 1000, slots: 5 });
    const { worker, submissionId } = await workerSubmits(campaignId);

    expectOk(await approveSubmission(client.id, submissionId));

    expect(await getBalance(worker.id)).toEqual({ available: 0, pending: 900 });
    const earning = await prisma.ledgerEntry.findFirstOrThrow({ where: { campaignId, type: "EARNING" } });
    expect(earning.amount).toBe(900);
    expect(earning.status).toBe("PENDING");
    expect(earning.availableAt!.getTime()).toBeGreaterThan(addDays(new Date(), HOLD_DAYS - 1).getTime());

    const fee = await prisma.ledgerEntry.findFirstOrThrow({ where: { campaignId, type: "FEE" } });
    expect(fee.amount).toBe(100);
    expect(await campaignSum(campaignId)).toBe(-5000 + 900 + 100);
  });

  it("Coins werden nach Ablauf der Wartezeit verfügbar", async () => {
    const { client, campaignId } = await setupCampaign();
    const { worker, submissionId } = await workerSubmits(campaignId);
    expectOk(await approveSubmission(client.id, submissionId));

    await prisma.ledgerEntry.updateMany({
      where: { type: "EARNING" },
      data: { availableAt: new Date(Date.now() - 60_000) },
    });
    expect(await getBalance(worker.id)).toEqual({ available: 900, pending: 0 });
  });

  it("zweites Genehmigen zahlt nicht noch einmal", async () => {
    const { client, campaignId } = await setupCampaign();
    const { submissionId } = await workerSubmits(campaignId);
    expectOk(await approveSubmission(client.id, submissionId));
    expectFail(await approveSubmission(client.id, submissionId));

    expect(await countLedger({ campaignId, type: "EARNING" })).toBe(1);
    expect(await countLedger({ campaignId, type: "FEE" })).toBe(1);
  });

  it("gleichzeitiges Genehmigen zahlt höchstens einmal", async () => {
    const { client, campaignId } = await setupCampaign();
    const { submissionId } = await workerSubmits(campaignId);
    await Promise.all([
      approveSubmission(client.id, submissionId),
      approveSubmission(client.id, submissionId),
      approveSubmission(client.id, submissionId),
    ]);

    const earnings = await countLedger({ campaignId, type: "EARNING" });
    const fees = await countLedger({ campaignId, type: "FEE" });
    expect(earnings).toBeLessThanOrEqual(1);
    expect(fees).toBe(earnings);
  });

  it("ein fremder Auftraggeber kann nicht genehmigen", async () => {
    const { campaignId } = await setupCampaign();
    const { submissionId } = await workerSubmits(campaignId);
    const other = await makeUser("CLIENT");

    expectFail(await approveSubmission(other.id, submissionId));
    expect(await countLedger({ type: "EARNING" })).toBe(0);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })).status).toBe("SUBMITTED");
  });

  it("rundet die Gebühr ab: Belohnung 15 ergibt 14 plus 1", async () => {
    const { client, campaignId } = await setupCampaign({ reward: 15, slots: 1, clientCoins: 100 });
    const { worker, submissionId } = await workerSubmits(campaignId);
    expectOk(await approveSubmission(client.id, submissionId));

    expect((await getBalance(worker.id)).pending).toBe(14);
    expect(await campaignSum(campaignId)).toBe(0);
  });

  it("bei Belohnung 9 fällt keine Gebühr an", async () => {
    const { client, campaignId } = await setupCampaign({ reward: 9, slots: 1, clientCoins: 100 });
    const { worker, submissionId } = await workerSubmits(campaignId);
    expectOk(await approveSubmission(client.id, submissionId));

    expect((await getBalance(worker.id)).pending).toBe(9);
    expect(await countLedger({ campaignId, type: "FEE" })).toBe(0);
    expect(await campaignSum(campaignId)).toBe(0);
  });
});

describe("Ablehnen", () => {
  it("zahlt nichts aus und lässt das Budget im Escrow", async () => {
    const { client, campaignId } = await setupCampaign();
    const { worker, submissionId } = await workerSubmits(campaignId);
    expectOk(await rejectSubmission(client.id, submissionId));

    expect(await getBalance(worker.id)).toEqual({ available: 0, pending: 0 });
    expect(await campaignSum(campaignId)).toBe(-5000);
  });

  it("nach dem Beenden geht der frei gewordene Platz zurück an den Auftraggeber", async () => {
    const { client, campaignId } = await setupCampaign({ slots: 5 });
    const { submissionId } = await workerSubmits(campaignId);
    expectOk(await closeCampaign(client.id, campaignId)); // 4 freie Plätze: +4000
    expectOk(await rejectSubmission(client.id, submissionId)); // +1000

    expect(await campaignSum(campaignId)).toBe(0);
  });

  it("eine bewertete Einreichung lässt sich nicht mehr ablehnen", async () => {
    const { client, campaignId } = await setupCampaign();
    const { submissionId } = await workerSubmits(campaignId);
    expectOk(await approveSubmission(client.id, submissionId));
    expectFail(await rejectSubmission(client.id, submissionId));
  });
});

describe("Beenden mit offenen Einreichungen", () => {
  it("späteres Genehmigen löst das Escrow exakt auf", async () => {
    const { client, campaignId } = await setupCampaign({ slots: 5 });
    const { submissionId } = await workerSubmits(campaignId);
    expectOk(await closeCampaign(client.id, campaignId));
    expectOk(await approveSubmission(client.id, submissionId));

    expect(await campaignSum(campaignId)).toBe(0);
  });
});

describe("Auto-Freigabe", () => {
  it("genehmigt nur Einreichungen, die länger als die Frist offen sind", async () => {
    const { campaignId } = await setupCampaign();
    const old = await workerSubmits(campaignId);
    const fresh = await workerSubmits(campaignId);
    await prisma.submission.update({
      where: { id: old.submissionId },
      data: { createdAt: addDays(new Date(), -(REVIEW_DAYS + 1)) },
    });

    expect(await autoApproveDue()).toBe(1);

    expect((await prisma.submission.findUniqueOrThrow({ where: { id: old.submissionId } })).status).toBe("APPROVED");
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: fresh.submissionId } })).status).toBe("SUBMITTED");
    const earning = await prisma.ledgerEntry.findFirstOrThrow({ where: { type: "EARNING" } });
    expect(earning.note).toContain("Automatisch");
    expect((await getBalance(old.worker.id)).pending).toBe(900);
  });

  it("ein zweiter Lauf zahlt nichts doppelt", async () => {
    const { campaignId } = await setupCampaign();
    const old = await workerSubmits(campaignId);
    await prisma.submission.update({
      where: { id: old.submissionId },
      data: { createdAt: addDays(new Date(), -(REVIEW_DAYS + 1)) },
    });

    expect(await autoApproveDue()).toBe(1);
    expect(await autoApproveDue()).toBe(0);
    expect(await countLedger({ type: "EARNING" })).toBe(1);
  });
});
