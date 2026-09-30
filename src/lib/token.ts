// Edge-tauglich (nur jose), wird von Middleware und Server-Code genutzt.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const SESSION_COOKIE = "session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  }
  return new TextEncoder().encode(s);
}

export async function signToken(userId: string, role: Role, version: number) {
  return new SignJWT({ role, v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());
}

export async function verifyToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { userId: payload.sub, role: payload.role as Role, version: Number(payload.v ?? 0) };
  } catch {
    return null;
  }
}
