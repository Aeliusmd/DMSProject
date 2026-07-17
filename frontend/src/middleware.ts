import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPortalRouteBlocked,
  PORTAL_ROUTE_REDIRECT,
} from "@/lib/portalNavigationVisibility";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPortalRouteBlocked(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(PORTAL_ROUTE_REDIRECT, request.url));
}

export const config = {
  matcher: [
    "/landingpage/:path*",
    "/company-portal/:path*",
    "/personalrequest/:path*",
    "/Subpoenaupload/:path*",
  ],
};
