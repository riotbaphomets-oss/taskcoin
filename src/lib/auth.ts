import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { homeFor, type Role } from "./roles";
import { SESSION_COOKIE, SESSION_SECONDS, signToken, verifyToken } from "./token";

export async function createSession(userId: string, role: Role, version: number) {
  const token = await signToken(userId, role, version);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

// Nur in Server Actions oder Route Handlern aufrufen (Cookies lassen sich beim Rendern nicht ändern).
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Lädt den angemeldeten Nutzer. Ungültige Sitzungen (gesperrt, Passwort geändert)
// werden über /api/logout beendet, weil dort das Cookie gelöscht werden darf.
export async function requireSessionUser() {
  const cookieStore = await cookies();
  const session = await verifyToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.disabled || user.tokenVersion !== session.version) {
    redirect("/api/logout");
  }
  return user;
}

// Wie requireSessionUser, verlangt aber bestätigte E-Mail und optional eine Rolle.
export async function requireUser(allowed?: Role) {
  const user = await requireSessionUser();
  if (!user.emailVerifiedAt) redirect("/verify-pending");
  if (allowed && user.role !== allowed) redirect(homeFor(user.role));
  return user;
}
