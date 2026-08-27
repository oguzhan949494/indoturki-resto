import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, hashAdminPassword } from "@/lib/admin-auth";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Giriş sayfasının kendisi korumasız olmalı, yoksa kimse giriş yapamaz.
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  // .env.local içinde ADMIN_PASSWORD tanımlı değilse, kazara paneli
  // korumasız bırakmamak için yine giriş sayfasına yönlendiriyoruz.
  if (!adminPassword) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("missing", "1");
    return NextResponse.redirect(loginUrl);
  }

  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const expectedToken = await hashAdminPassword(adminPassword);

  if (sessionCookie && sessionCookie === expectedToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
