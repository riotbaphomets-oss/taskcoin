import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType } from "@prisma/client";
import { prisma } from "./db";

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

// Erzeugt einen Einmal-Token. Ältere, unbenutzte Tokens gleichen Typs werden ungültig.
export async function createAuthToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return raw;
}

// Verbraucht den Token atomar. Gibt die Nutzer-ID zurück oder null, wenn ungültig, benutzt oder abgelaufen.
export async function consumeAuthToken(raw: string | undefined, type: AuthTokenType) {
  if (!raw) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt <= new Date()) return null;

  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1 ? row.userId : null;
}
