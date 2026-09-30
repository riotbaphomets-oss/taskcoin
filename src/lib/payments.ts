import "server-only";
import type { Prisma } from "@prisma/client";
import { UserError } from "./tx";

// Schließt einen Kauf ab und bucht die Coins. Idempotent: ein zweiter Aufruf bucht nichts.
// Später ruft der Zahlungs-Webhook genau diese Funktion auf.
export async function completePurchaseInTx(tx: Prisma.TransactionClient, purchaseId: string) {
  const purchase = await tx.coinPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new UserError("Kauf nicht gefunden.");

  const updated = await tx.coinPurchase.updateMany({
    where: { id: purchaseId, status: "PENDING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (updated.count !== 1) return false;

  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: purchase.userId } });
  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      amount: purchase.coins,
      type: "DEPOSIT",
      note: `Coin-Kauf (${purchase.provider})`,
    },
  });
  return true;
}
