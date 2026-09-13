import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sessao";

const ROTAS_PUBLICAS = [
  "/login",
  "/esqueceu-senha",
  "/redefinir-senha",
];

function ehRotaPublica(pathname: string) {
  return ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

function ehArquivoEstatico(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function redirecionarPara(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

async function sessaoDoPedido(token?: string) {
  if (!token || !process.env.AUTH_SECRET) {
    return {
      autenticado: false,
      role: null as string | null,
      primeiroAcesso: false,
    };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.AUTH_SECRET),
    );
    return {
      autenticado: true,
      role: typeof payload.role === "string" ? payload.role : null,
      primeiroAcesso: payload.primeiroAcesso === true,
    };
  } catch {
    return {
      autenticado: false,
      role: null as string | null,
      primeiroAcesso: false,
    };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ehArquivoEstatico(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { autenticado, role, primeiroAcesso } = await sessaoDoPedido(token);
  const isAuthApi = pathname.startsWith("/api/auth");
  const isResetUsuario = pathname.startsWith("/api/reset-usuario");
  const isNovaSenha = pathname === "/nova-senha" || pathname.startsWith("/nova-senha/");

  if (isAuthApi || isResetUsuario) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api") && !autenticado) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (pathname.startsWith("/api") && primeiroAcesso) {
    return NextResponse.json(
      { error: "Defina uma nova senha para continuar." },
      { status: 403 },
    );
  }

  if (ehRotaPublica(pathname)) {
    if (autenticado && pathname.startsWith("/login")) {
      return redirecionarPara(
        request,
        primeiroAcesso ? "/nova-senha" : "/condominios",
      );
    }

    return NextResponse.next();
  }

  if (!autenticado) {
    return redirecionarPara(request, "/login");
  }

  if (primeiroAcesso && !isNovaSenha) {
    return redirecionarPara(request, "/nova-senha");
  }

  if (!primeiroAcesso && isNovaSenha) {
    return redirecionarPara(request, "/condominios");
  }

  if (
    (pathname.startsWith("/admin/gestores") ||
      pathname.startsWith("/admin/vincular-condominio")) &&
    role === "GESTOR_ADMIN"
  ) {
    return redirecionarPara(request, "/admin/usuarios");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)",
  ],
};
