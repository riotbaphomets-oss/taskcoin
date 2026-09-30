"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  approveSubmission,
  closeCampaign,
  createCampaign,
  grantCoins,
  rejectSubmission,
  submitWork,
} from "@/lib/money";
import { autoApproveDue } from "@/lib/payout";
import { formatCoins } from "@/lib/wallet";

export type ActionState = { error?: string; message?: string } | undefined;

const campaignSchema = z.object({
  title: z.string().trim().min(3, "Der Titel braucht mindestens 3 Zeichen.").max(80),
  description: z.string().trim().min(10, "Beschreibe die Aufgabe in mindestens 10 Zeichen.").max(1500),
  rewardCoins: z.coerce.number().int("Coins pro Aufgabe müssen eine ganze Zahl sein.").min(1).max(100_000),
  slots: z.coerce.number().int("Die Anzahl Plätze muss eine ganze Zahl sein.").min(1).max(10_000),
});

export async function createCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("CLIENT");
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await createCampaign(user.id, parsed.data);
  if (!result.ok) return { error: result.error };
  redirect(`/client/campaigns/${result.value}`);
}

export async function closeCampaignAction(formData: FormData) {
  const user = await requireUser("CLIENT");
  await closeCampaign(user.id, String(formData.get("campaignId") ?? ""));
  revalidatePath("/client");
  revalidatePath("/client/campaigns/[id]", "page");
}

const submitSchema = z.object({
  campaignId: z.string().min(1),
  answer: z.string().trim().min(3, "Bitte gib eine Antwort an.").max(2000),
});

export async function submitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("WORKER");
  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await submitWork(user.id, parsed.data.campaignId, parsed.data.answer);
  if (!result.ok) return { error: result.error };
  redirect("/worker");
}

export async function approveSubmissionAction(formData: FormData) {
  const user = await requireUser("CLIENT");
  await approveSubmission(user.id, String(formData.get("submissionId") ?? ""));
  revalidatePath("/client");
  revalidatePath("/client/campaigns/[id]", "page");
}

export async function rejectSubmissionAction(formData: FormData) {
  const user = await requireUser("CLIENT");
  await rejectSubmission(user.id, String(formData.get("submissionId") ?? ""));
  revalidatePath("/client");
  revalidatePath("/client/campaigns/[id]", "page");
}

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an."),
  amount: z.coerce.number().int().min(1, "Der Betrag muss mindestens 1 sein.").max(1_000_000),
});

// Nur für Tests, bis der Coin-Kauf (Phase 4) existiert.
export async function grantCoinsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("ADMIN");
  const parsed = grantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await grantCoins(parsed.data.email, parsed.data.amount);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin");
  return { message: `${formatCoins(parsed.data.amount)} Coins an ${result.value} gebucht.` };
}

export async function runAutoApproveAction(_prev: ActionState): Promise<ActionState> {
  await requireUser("ADMIN");
  const n = await autoApproveDue();
  revalidatePath("/admin");
  return { message: `${n} Einreichung(en) automatisch freigegeben.` };
}
