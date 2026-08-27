import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  hashAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      {
        error:
          "Sunucuda ADMIN_PASSWORD tanımlı değil. .env.local dosyasını kontrol edin.",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = body?.password as string | undefined;

  if (!password || password !== adminPassword) {
    return NextResponse.json(
      { error: "Şifre hatalı." },
      { status: 401 }
    );
  }

  const token = await hashAdminPassword(adminPassword);

  const response = NextResponse.json({ ok: true });

  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}