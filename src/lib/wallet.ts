import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Verfügbar = direkt verfügbare Einträge + Einträge, deren Wartezeit abgelaufen ist.
// Das Ledger wird dafür nie verändert.
function availableWhere(now: Date): Prisma.LedgerEntryWhereInput {
  return {
    OR: [{ status: "AVAILABLE" }, { status: "PENDING", availableAt: { lte: now } }],
  };
}

export async function getBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return { available: 0, pending: 0 };

  const now = new Date();
  const [a, p] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id, ...availableWhere(now) },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id, status: "PENDING", availableAt: { gt: now } },
      _sum: { amount: true },
    }),
  ]);
  return { available: a._sum.amount ?? 0, pending: p._sum.amount ?? 0 };
}

// Verfügbares Guthaben innerhalb einer Transaktion (für Prüfungen vor dem Sperren).
export async function balanceInTx(tx: Prisma.TransactionClient, walletId: string) {
  const r = await tx.ledgerEntry.aggregate({
    where: { walletId, ...availableWhere(new Date()) },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export const formatCoins = (n: number) => n.toLocaleString("de-DE");

export async function recentEntries(userId: string, take = 15) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return [];
  return prisma.ledgerEntry.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take,
  });
}
