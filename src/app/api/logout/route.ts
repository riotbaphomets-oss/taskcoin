import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/token";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
