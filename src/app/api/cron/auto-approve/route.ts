import { prisma } from "@/lib/db";
import { autoApproveDue } from "@/lib/payout";

export const dynamic = "force-dynamic";

// Stündlich aufrufen, z. B.: curl -H "Authorization: Bearer $CRON_SECRET" https://deine-domain/api/cron/auto-approve
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const approved = await autoApproveDue();

  // Abgelaufene Rate-Limits und alte Tokens entfernen.
  const now = new Date();
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  await prisma.authToken.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
  });

  return Response.json({ approved });
}
