import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("crm_session");
  const { pathname } = request.nextUrl;

  // Allow API auth endpoints to be requested freely
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 1. If not authenticated and trying to access private dashboard pages, redirect to /login
  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. If authenticated and trying to access the login page, redirect back to home /
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files, Next.js optimization assets, and favicon:
     */
    "/((?!_next/static|_next/image|favicon.ico|assets).*)",
  ],
};
