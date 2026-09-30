import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export class UserError extends Error {}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Alle Geldbewegungen laufen in Serializable-Transaktionen: Prüfung und Buchung sind atomar.
export async function runTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<Result<T>> {
  try {
    const value = await prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    return { ok: true, value };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2034" || e.code === "P2002")
    ) {
      return { ok: false, error: "Das hat gerade nicht geklappt. Bitte versuche es noch einmal." };
    }
    throw e;
  }
}
