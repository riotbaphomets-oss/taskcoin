"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth";
import { createAuthToken } from "@/lib/auth-tokens";
import { appUrl } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { homeFor } from "@/lib/roles";

export type FormState = { error?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an.").max(60),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an."),
  password: z
    .string()
    .min(10, "Das Passwort braucht mindestens 10 Zeichen.")
    .max(100),
  role: z.enum(["WORKER", "CLIENT"]),
});

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, role } = parsed.data;
  const clientIp = await getClientIp();

  if (!(await rateLimit(`register:ip:${clientIp}`, 5, 3600))) {
    return { error: "Zu viele Registrierungen von dieser Adresse. Bitte versuche es später noch einmal." };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Diese E-Mail-Adresse ist bereits registriert." };

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 12),
      wallet: { create: {} },
    },
  });

  const token = await createAuthToken(user.id, "VERIFY_EMAIL", 60 * 24);
  await sendMail({
    to: email,
    subject: "Bestätige deine E-Mail-Adresse",
    text: `Hallo ${name},\n\nbitte bestätige deine E-Mail-Adresse:\n${appUrl()}/verify?token=${token}\n\nDer Link gilt 24 Stunden. Wenn du dich nicht bei TaskCoin registriert hast, ignoriere diese E-Mail.`,
  });

  await createSession(user.id, user.role, user.tokenVersion);
  redirect("/verify-pending");
}

// Vergleich auch bei unbekannter E-Mail, damit die Antwortzeit nichts verrät.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const clientIp = await getClientIp();

  const allowed =
    (await rateLimit(`login:ip:${clientIp}`, 30, 900)) &&
    (await rateLimit(`login:email:${email}`, 8, 900));
  if (!allowed) return { error: "Zu viele Anmeldeversuche. Bitte warte 15 Minuten." };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabled) {
    return { error: "E-Mail oder Passwort stimmt nicht." };
  }

  await createSession(user.id, user.role, user.tokenVersion);
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
