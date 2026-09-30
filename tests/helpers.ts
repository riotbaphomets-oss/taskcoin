import type { LedgerType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createCampaign } from "@/lib/money";

export async function resetDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).pathname.includes("test")) throw new Error("resetDb nur gegen eine Test-Datenbank.");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "LedgerEntry","Withdrawal","CoinPurchase","Submission","Campaign","AuthToken","RateLimit","Wallet","User" RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;

export async function addLedger(
  walletId: string,
  amount: number,
  type: LedgerType,
  extra: Partial<Omit<Prisma.LedgerEntryUncheckedCreateInput, "walletId" | "amount" | "type">> = {},
) {
  return prisma.ledgerEntry.create({ data: { walletId, amount, type, ...extra } });
}

export async function makeUser(role: Role, opts: { coins?: number; kyc?: boolean } = {}) {
  counter++;
  const user = await prisma.user.create({
    data: {
      email: `user${counter}@test.local`,
      name: `User ${counter}`,
      passwordHash: "x",
      role,
      kycVerified: opts.kyc ?? false,
      emailVerifiedAt: new Date(),
      wallet: { create: {} },
    },
    include: { wallet: true },
  });
  if (opts.coins) await addLedger(user.wallet!.id, opts.coins, "ADJUSTMENT");
  return user;
}

type R<T> = { ok: true; value: T } | { ok: false; error: string };

export function expectOk<T>(r: R<T>): T {
  if (!r.ok) throw new Error(`Erwartet Erfolg, bekam Fehler: ${r.error}`);
  return r.value;
}

export function expectFail<T>(r: R<T>): string {
  if (r.ok) throw new Error("Erwartet Fehler, bekam Erfolg.");
  return r.error;
}

export async function campaignSum(campaignId: string) {
  const r = await prisma.ledgerEntry.aggregate({ where: { campaignId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

export async function countLedger(where: Prisma.LedgerEntryWhereInput) {
  return prisma.ledgerEntry.count({ where });
}

// Startet eine Kampagne mit einem Auftraggeber, der genug Guthaben hat.
export async function setupCampaign(opts: { reward?: number; slots?: number; clientCoins?: number } = {}) {
  const reward = opts.reward ?? 1000;
  const slots = opts.slots ?? 5;
  const client = await makeUser("CLIENT", { coins: opts.clientCoins ?? 20_000 });
  const campaignId = expectOk(
    await createCampaign(client.id, {
      title: "Testkampagne",
      description: "Eine Beschreibung mit genug Zeichen.",
      rewardCoins: reward,
      slots,
    }),
  );
  return { client, campaignId, reward, slots };
}
