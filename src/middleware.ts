import { NextResponse, type NextRequest } from "next/server";
import { areaFor, homeFor } from "@/lib/roles";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  const area = areaFor(pathname);

  if (area) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (session.role !== area) {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
  } else if (session) {
    // /login und /register sind für Angemeldete überflüssig
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/worker/:path*", "/client/:path*", "/admin/:path*", "/login", "/register"],
};
