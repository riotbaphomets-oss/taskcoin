"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "./campaigns";
import { requireSessionUser } from "@/lib/auth";
import { consumeAuthToken, createAuthToken } from "@/lib/auth-tokens";
import { appUrl } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { homeFor } from "@/lib/roles";

export async function resendVerificationAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireSessionUser();
  if (user.emailVerifiedAt) redirect(homeFor(user.role));

  if (!(await rateLimit(`verify:user:${user.id}`, 3, 3600))) {
    return { error: "Du hast schon mehrfach angefragt. Bitte versuche es in einer Stunde noch einmal." };
  }
  const token = await createAuthToken(user.id, "VERIFY_EMAIL", 60 * 24);
  await sendMail({
    to: user.email,
    subject: "Bestätige deine E-Mail-Adresse",
    text: `Hallo ${user.name},\n\nhier ist dein neuer Bestätigungslink:\n${appUrl()}/verify?token=${token}\n\nDer Link gilt 24 Stunden.`,
  });
  return { message: "Wir haben dir eine neue E-Mail geschickt." };
}

const emailSchema = z.string().trim().toLowerCase().email();

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return { error: "Bitte gib eine gültige E-Mail-Adresse an." };
  const email = parsed.data;
  const clientIp = await getClientIp();

  const allowed =
    (await rateLimit(`forgot:ip:${clientIp}`, 5, 3600)) &&
    (await rateLimit(`forgot:email:${email}`, 3, 3600));
  if (!allowed) return { error: "Zu viele Anfragen. Bitte versuche es später noch einmal." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.disabled) {
    const token = await createAuthToken(user.id, "RESET_PASSWORD", 60);
    await sendMail({
      to: email,
      subject: "Passwort zurücksetzen",
      text: `Hallo ${user.name},\n\nhier kannst du ein neues Passwort festlegen:\n${appUrl()}/reset-password?token=${token}\n\nDer Link gilt 60 Minuten und nur einmal. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.`,
    });
  }
  // Gleiche Antwort in beiden Fällen, damit niemand Konten erraten kann.
  return { message: "Wenn es zu dieser Adresse ein Konto gibt, haben wir dir eine E-Mail geschickt." };
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen.").max(100),
    passwordRepeat: z.string(),
  })
  .refine((v) => v.password === v.passwordRepeat, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordRepeat"],
  });

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const clientIp = await getClientIp();

  if (!(await rateLimit(`reset:ip:${clientIp}`, 10, 3600))) {
    return { error: "Zu viele Versuche. Bitte versuche es später noch einmal." };
  }

  // Erst nach erfolgreicher Prüfung des Passworts wird der Token verbraucht.
  const userId = await consumeAuthToken(parsed.data.token, "RESET_PASSWORD");
  if (!userId) return { error: "Der Link ist ungültig oder abgelaufen. Fordere einen neuen an." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      tokenVersion: { increment: 1 }, // beendet alle bestehenden Sitzungen
    },
  });
  // Wer den Link aus dem Postfach nutzen konnte, hat die Adresse damit auch bestätigt.
  await prisma.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  redirect("/login?reset=1");
}
