import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const APPROVED_EMAILS = (process.env.APPROVED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Always public
  if (
    pathname === "/" ||
    pathname.startsWith("/waitlisted") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/waitlist") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/scan") ||
    pathname.startsWith("/api/runtime") ||
    pathname.startsWith("/api/vendors")
  ) {
    return NextResponse.next();
  }

  // Not logged in → send to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in but not approved → waitlisted page
  const userEmail = req.auth?.user?.email?.toLowerCase() ?? "";
  if (APPROVED_EMAILS.length > 0 && !APPROVED_EMAILS.includes(userEmail)) {
    return NextResponse.redirect(new URL("/waitlisted", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
