import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { closeCampaign, createCampaign, rejectSubmission, submitWork } from "@/lib/money";
import { getBalance } from "@/lib/wallet";
import { countLedger, expectFail, expectOk, makeUser, resetDb, setupCampaign } from "../helpers";

beforeEach(resetDb);

const input = { title: "Titel", description: "Eine Beschreibung mit genug Zeichen.", rewardCoins: 1000, slots: 5 };

describe("Kampagne starten (Escrow)", () => {
  it("sperrt das Gesamtbudget im Ledger", async () => {
    const client = await makeUser("CLIENT", { coins: 20_000 });
    const id = expectOk(await createCampaign(client.id, input));

    expect((await getBalance(client.id)).available).toBe(15_000);
    const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { campaignId: id } });
    expect(entry.type).toBe("ESCROW_LOCK");
    expect(entry.amount).toBe(-5000);
  });

  it("lehnt ab, wenn das Guthaben nicht reicht, und ändert nichts", async () => {
    const client = await makeUser("CLIENT", { coins: 4999 });
    expectFail(await createCampaign(client.id, input));

    expect(await prisma.campaign.count()).toBe(0);
    expect((await getBalance(client.id)).available).toBe(4999);
  });

  it("lehnt ungültige Beträge ab (negativ, null, Kommazahl)", async () => {
    const client = await makeUser("CLIENT", { coins: 10_000 });
    for (const bad of [
      { ...input, rewardCoins: -100 },
      { ...input, rewardCoins: 0 },
      { ...input, rewardCoins: 1.5 },
      { ...input, slots: 0 },
      { ...input, slots: -3 },
    ]) {
      expectFail(await createCampaign(client.id, bad));
    }
    expect(await prisma.campaign.count()).toBe(0);
    expect((await getBalance(client.id)).available).toBe(10_000);
  });

  it("Guthaben kann bei gleichzeitigen Starts nicht doppelt ausgegeben werden", async () => {
    const client = await makeUser("CLIENT", { coins: 5000 });
    const results = await Promise.all([createCampaign(client.id, input), createCampaign(client.id, input)]);

    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBeLessThanOrEqual(1);
    const { available } = await getBalance(client.id);
    expect(available).toBe(5000 - 5000 * okCount);
    expect(available).toBeGreaterThanOrEqual(0);
  });
});

describe("Einreichen", () => {
  it("erlaubt pro Worker nur eine Einreichung", async () => {
    const { campaignId } = await setupCampaign();
    const worker = await makeUser("WORKER");
    expectOk(await submitWork(worker.id, campaignId, "Antwort"));
    expect(expectFail(await submitWork(worker.id, campaignId, "Nochmal"))).toContain("schon eingereicht");
    expect(await prisma.submission.count()).toBe(1);
  });

  it("vergibt nie mehr Plätze als vorhanden, abgelehnte geben ihren Platz frei", async () => {
    const { client, campaignId } = await setupCampaign({ slots: 1 });
    const w1 = await makeUser("WORKER");
    const w2 = await makeUser("WORKER");

    const sub1 = expectOk(await submitWork(w1.id, campaignId, "A"));
    expect(expectFail(await submitWork(w2.id, campaignId, "B"))).toContain("Plätze");

    expectOk(await rejectSubmission(client.id, sub1));
    expectOk(await submitWork(w2.id, campaignId, "B"));
  });

  it("gleichzeitige Einreichungen überbuchen den letzten Platz nicht", async () => {
    const { campaignId } = await setupCampaign({ slots: 1 });
    const workers = await Promise.all([makeUser("WORKER"), makeUser("WORKER"), makeUser("WORKER")]);
    await Promise.all(workers.map((w) => submitWork(w.id, campaignId, "Antwort")));

    const used = await prisma.submission.count({ where: { campaignId, status: { not: "REJECTED" } } });
    expect(used).toBeLessThanOrEqual(1);
  });

  it("nimmt bei beendeter Kampagne nichts mehr an", async () => {
    const { client, campaignId } = await setupCampaign();
    expectOk(await closeCampaign(client.id, campaignId));
    const worker = await makeUser("WORKER");
    expectFail(await submitWork(worker.id, campaignId, "Zu spät"));
  });
});

describe("Kampagne beenden", () => {
  it("bucht nicht vergebene Plätze zurück", async () => {
    const { client, campaignId } = await setupCampaign({ slots: 5 });
    const worker = await makeUser("WORKER");
    expectOk(await submitWork(worker.id, campaignId, "A"));

    const refund = expectOk(await closeCampaign(client.id, campaignId));
    expect(refund).toBe(4000);
    expect((await getBalance(client.id)).available).toBe(20_000 - 5000 + 4000);
  });

  it("zweites Beenden bucht nichts mehr zurück", async () => {
    const { client, campaignId } = await setupCampaign();
    expectOk(await closeCampaign(client.id, campaignId));
    expectFail(await closeCampaign(client.id, campaignId));
    expect(await countLedger({ campaignId, type: "ESCROW_RELEASE" })).toBe(1);
  });

  it("ein fremder Auftraggeber kann sie nicht beenden", async () => {
    const { campaignId } = await setupCampaign();
    const other = await makeUser("CLIENT");
    expectFail(await closeCampaign(other.id, campaignId));
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status).toBe("ACTIVE");
  });

  it("ohne freie Plätze gibt es keine Rückbuchung", async () => {
    const { client, campaignId } = await setupCampaign({ slots: 1 });
    const worker = await makeUser("WORKER");
    expectOk(await submitWork(worker.id, campaignId, "A"));
    expect(expectOk(await closeCampaign(client.id, campaignId))).toBe(0);
    expect(await countLedger({ campaignId, type: "ESCROW_RELEASE" })).toBe(0);
  });
});
