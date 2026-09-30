"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "./campaigns";
import { requireUser } from "@/lib/auth";
import { MIN_PAYOUT_COINS, paymentsSimulated } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  buyCoins,
  markWithdrawalPaid,
  rejectWithdrawal,
  requestWithdrawal,
} from "@/lib/money";
import { formatCoins } from "@/lib/wallet";

// Testkauf: legt den Kauf an und schließt ihn sofort ab. Kein echtes Geld.
export async function buyCoinsSimulatedAction(formData: FormData) {
  const user = await requireUser("CLIENT");
  if (!paymentsSimulated()) redirect("/client/wallet");

  await buyCoins(user.id, String(formData.get("packageId") ?? ""));
  revalidatePath("/client");
  revalidatePath("/client/wallet");
  redirect("/client/wallet");
}

const withdrawSchema = z.object({
  coins: z.coerce
    .number()
    .int("Bitte gib eine ganze Zahl an.")
    .min(MIN_PAYOUT_COINS, `Die Mindestauszahlung beträgt ${formatCoins(MIN_PAYOUT_COINS)} Coins.`),
  payoutTarget: z.string().trim().toLowerCase().email("Bitte gib eine gültige PayPal-E-Mail-Adresse an."),
});

export async function requestWithdrawalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("WORKER");
  if (!paymentsSimulated()) return { error: "Auszahlungen sind noch nicht aktiviert." };

  const parsed = withdrawSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await requestWithdrawal(user.id, parsed.data.coins, parsed.data.payoutTarget);
  if (!result.ok) return { error: result.error };

  revalidatePath("/worker");
  revalidatePath("/worker/wallet");
  revalidatePath("/admin");
  return { message: "Deine Auszahlung wurde angefragt. Sie wird jetzt geprüft." };
}

export async function markWithdrawalPaidAction(formData: FormData) {
  await requireUser("ADMIN");
  await markWithdrawalPaid(String(formData.get("withdrawalId") ?? ""));
  revalidatePath("/admin");
}

export async function rejectWithdrawalAction(formData: FormData) {
  await requireUser("ADMIN");
  await rejectWithdrawal(String(formData.get("withdrawalId") ?? ""));
  revalidatePath("/admin");
}

export async function toggleKycAction(formData: FormData) {
  await requireUser("ADMIN");
  const id = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  await prisma.user.update({ where: { id }, data: { kycVerified: !target.kycVerified } });
  revalidatePath("/admin");
}
