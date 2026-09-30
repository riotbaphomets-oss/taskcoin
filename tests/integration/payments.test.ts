import { beforeEach, describe, expect, it } from "vitest";
import { KYC_THRESHOLD_COINS, MIN_PAYOUT_COINS } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  buyCoins,
  grantCoins,
  markWithdrawalPaid,
  rejectWithdrawal,
  requestWithdrawal,
} from "@/lib/money";
import { completePurchaseInTx } from "@/lib/payments";
import { runTx } from "@/lib/tx";
import { getBalance } from "@/lib/wallet";
import { addLedger, countLedger, expectFail, expectOk, makeUser, resetDb } from "../helpers";

beforeEach(resetDb);

describe("Coin-Kauf", () => {
  it("bucht die Coins des Pakets gut", async () => {
    const client = await makeUser("CLIENT");
    expectOk(await buyCoins(client.id, "s"));

    expect((await getBalance(client.id)).available).toBe(10_000);
    const purchase = await prisma.coinPurchase.findFirstOrThrow();
    expect(purchase.status).toBe("COMPLETED");
    expect(purchase.amountCents).toBe(999);
  });

  it("lehnt unbekannte Pakete ab und legt nichts an", async () => {
    const client = await makeUser("CLIENT");
    expectFail(await buyCoins(client.id, "gibt-es-nicht"));
    expect(await prisma.coinPurchase.count()).toBe(0);
    expect((await getBalance(client.id)).available).toBe(0);
  });

  it("Abschluss ist idempotent: ein Webhook, der zweimal kommt, bucht nur einmal", async () => {
    const client = await makeUser("CLIENT");
    const purchase = await prisma.coinPurchase.create({
      data: { userId: client.id, coins: 10_000, amountCents: 999, provider: "test" },
    });

    const first = expectOk(await runTx((tx) => completePurchaseInTx(tx, purchase.id)));
    const second = expectOk(await runTx((tx) => completePurchaseInTx(tx, purchase.id)));

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await countLedger({ type: "DEPOSIT" })).toBe(1);
    expect((await getBalance(client.id)).available).toBe(10_000);
  });
});

describe("Test-Guthaben durch Admin", () => {
  it("bucht gut und lehnt ungültige Angaben ab", async () => {
    const user = await makeUser("CLIENT");
    expectOk(await grantCoins(user.email, 500));
    expect((await getBalance(user.id)).available).toBe(500);

    expectFail(await grantCoins(user.email, 0));
    expectFail(await grantCoins(user.email, -500));
    expectFail(await grantCoins(user.email, 1.5));
    expectFail(await grantCoins("niemand@test.local", 100));
    expect((await getBalance(user.id)).available).toBe(500);
  });
});

describe("Auszahlung anfragen", () => {
  it("bucht sofort ab und legt die Anfrage an", async () => {
    const worker = await makeUser("WORKER", { coins: 10_000 });
    expectOk(await requestWithdrawal(worker.id, 10_000, "pay@test.local"));

    expect((await getBalance(worker.id)).available).toBe(0);
    const w = await prisma.withdrawal.findFirstOrThrow();
    expect(w.status).toBe("REQUESTED");
    expect(w.amountCents).toBe(1000);
    expect(await countLedger({ type: "WITHDRAWAL", amount: -10_000 })).toBe(1);
  });

  it("verlangt den Mindestbetrag und ganze Zahlen", async () => {
    const worker = await makeUser("WORKER", { coins: 50_000 });
    expectFail(await requestWithdrawal(worker.id, MIN_PAYOUT_COINS - 1, "pay@test.local"));
    expectFail(await requestWithdrawal(worker.id, -10_000, "pay@test.local"));
    expectFail(await requestWithdrawal(worker.id, 10_000.5, "pay@test.local"));
    expect(await prisma.withdrawal.count()).toBe(0);
    expect((await getBalance(worker.id)).available).toBe(50_000);
  });

  it("erlaubt nie mehr als das verfügbare Guthaben", async () => {
    const worker = await makeUser("WORKER", { coins: 10_000 });
    expectFail(await requestWithdrawal(worker.id, 10_001, "pay@test.local"));
    expect(await prisma.withdrawal.count()).toBe(0);
  });

  it("Coins in der Wartezeit lassen sich nicht auszahlen, danach schon", async () => {
    const worker = await makeUser("WORKER");
    const entry = await addLedger(worker.wallet!.id, 20_000, "EARNING", {
      status: "PENDING",
      availableAt: new Date(Date.now() + 86_400_000),
    });
    expectFail(await requestWithdrawal(worker.id, 10_000, "pay@test.local"));

    await prisma.ledgerEntry.update({ where: { id: entry.id }, data: { availableAt: new Date(Date.now() - 1000) } });
    expectOk(await requestWithdrawal(worker.id, 10_000, "pay@test.local"));
  });

  it("verlangt über der Schwelle eine Identitätsprüfung", async () => {
    const unverified = await makeUser("WORKER", { coins: 200_000 });
    expectFail(await requestWithdrawal(unverified.id, KYC_THRESHOLD_COINS + 1, "pay@test.local"));
    expectOk(await requestWithdrawal(unverified.id, KYC_THRESHOLD_COINS, "pay@test.local")); // genau an der Schwelle

    const verified = await makeUser("WORKER", { coins: 200_000, kyc: true });
    expectOk(await requestWithdrawal(verified.id, KYC_THRESHOLD_COINS + 1, "pay@test.local"));
  });

  it("gleichzeitige Anfragen können das Guthaben nicht überziehen", async () => {
    const worker = await makeUser("WORKER", { coins: 10_000 });
    const results = await Promise.all([
      requestWithdrawal(worker.id, 10_000, "pay@test.local"),
      requestWithdrawal(worker.id, 10_000, "pay@test.local"),
      requestWithdrawal(worker.id, 10_000, "pay@test.local"),
    ]);

    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBeLessThanOrEqual(1);
    const { available } = await getBalance(worker.id);
    expect(available).toBe(10_000 - 10_000 * okCount);
    expect(available).toBeGreaterThanOrEqual(0);
  });
});

describe("Auszahlung bearbeiten", () => {
  async function pendingWithdrawal() {
    const worker = await makeUser("WORKER", { coins: 10_000 });
    const id = expectOk(await requestWithdrawal(worker.id, 10_000, "pay@test.local"));
    return { worker, id };
  }

  it("Ablehnen bucht die Coins genau einmal zurück", async () => {
    const { worker, id } = await pendingWithdrawal();
    expectOk(await rejectWithdrawal(id));
    expectFail(await rejectWithdrawal(id));

    expect((await getBalance(worker.id)).available).toBe(10_000);
    expect(await countLedger({ type: "WITHDRAWAL_REVERSAL" })).toBe(1);
  });

  it("nach dem Ablehnen lässt sich nicht mehr als bezahlt markieren", async () => {
    const { id } = await pendingWithdrawal();
    expectOk(await rejectWithdrawal(id));
    expectFail(await markWithdrawalPaid(id));
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
  });

  it("eine bezahlte Auszahlung lässt sich nicht mehr zurückbuchen", async () => {
    const { worker, id } = await pendingWithdrawal();
    expectOk(await markWithdrawalPaid(id));
    expectFail(await rejectWithdrawal(id));
    expectFail(await markWithdrawalPaid(id));

    expect((await getBalance(worker.id)).available).toBe(0);
    expect(await countLedger({ type: "WITHDRAWAL_REVERSAL" })).toBe(0);
  });
});
