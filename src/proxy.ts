import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sessao";

async function sessaoDoPedido(token?: string) {
  if (!token || !process.env.AUTH_SECRET) {
    return { autenticado: false, role: null as string | null };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.AUTH_SECRET),
    );
    return {
      autenticado: true,
      role: typeof payload.role === "string" ? payload.role : null,
    };
  } catch {
    return { autenticado: false, role: null as string | null };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { autenticado, role } = await sessaoDoPedido(token);
  const isLogin = pathname.startsWith("/login");
  const isEsqueceuSenha = pathname.startsWith("/esqueceu-senha");
  const isRedefinirSenha = pathname.startsWith("/redefinir-senha");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isResetUsuario = pathname.startsWith("/api/reset-usuario");
  const isPaginaPublica = isLogin || isEsqueceuSenha || isRedefinirSenha;

  if (isAuthApi || isResetUsuario) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api") && !autenticado) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!autenticado && !isPaginaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (autenticado && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/condominios";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin/gestores") && role && role !== "SUPER_ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/usuarios";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role === "OPERADOR") {
    const url = request.nextUrl.clone();
    url.pathname = "/condominios";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
