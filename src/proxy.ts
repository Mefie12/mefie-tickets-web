import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-mefie-return-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/tickets/:path*", "/dashboard/:path*", "/events/:path*", "/event-series/:path*", "/organization/:path*", "/settings/:path*", "/onboarding/:path*", "/distributor/:path*"] };
