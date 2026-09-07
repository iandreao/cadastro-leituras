import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

async function hasValidSession(token?: string) {
  if (!token || !process.env.AUTH_SECRET) {
    return false;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const autenticado = await hasValidSession(token);
  const isLogin = pathname.startsWith("/login");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isResetUsuario = pathname.startsWith("/api/reset-usuario");

  if (isAuthApi || isResetUsuario) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api") && !autenticado) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!autenticado && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (autenticado && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/condominios";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
