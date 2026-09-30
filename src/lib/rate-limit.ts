import "server-only";
import { prisma } from "./db";

// Festes Zeitfenster pro Schlüssel, gespeichert in Postgres (kein Redis nötig).
// true = erlaubt, false = Limit erreicht.
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const row = await prisma.rateLimit.findUnique({ where: { key } });

  if (!row || row.resetAt <= now) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return true;
  }
  if (row.count >= max) return false;

  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}
