import "server-only";
import { headers } from "next/headers";

// Hinter einem Proxy (Vercel, nginx) steht die echte Adresse in x-forwarded-for.
// Nur verlassen, wenn die App wirklich hinter einem vertrauenswürdigen Proxy läuft.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
