import { NextResponse } from "next/server";
import {
  exigirAmbienteAuth,
  repositorioUsuario,
  responderErroAuth,
} from "@/lib/auth-api";
import {
  applySessionCookie,
  createSessionToken,
  requireApiSession,
} from "@/lib/auth";
import { hashSenha } from "@/lib/senha";
import { novaSenhaSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENHA_INICIAL_BLOQUEADA = "Mudar@123";

export async function POST(request: Request) {
  const ambiente = exigirAmbienteAuth();

  if (ambiente) {
    return ambiente;
  }

  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = novaSenhaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    if (parsed.data.senha === SENHA_INICIAL_BLOQUEADA) {
      return NextResponse.json(
        { error: "Escolha uma senha diferente da senha inicial." },
        { status: 400 },
      );
    }

    const usuarios = await repositorioUsuario();
    const usuario = await usuarios.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        gestorId: true,
        ativo: true,
      },
    });

    if (!usuario || usuario.ativo === false) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      );
    }

    const hash = await hashSenha(parsed.data.senha);

    await usuarios.update({
      where: { id: usuario.id },
      data: {
        senha: hash,
        primeiroAcesso: false,
      },
    });

    const token = await createSessionToken({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role ?? "OPERADOR",
      gestorId: usuario.gestorId ?? null,
      primeiroAcesso: false,
    });

    return applySessionCookie(NextResponse.json({ ok: true }), token);
  } catch (error) {
    return responderErroAuth(error);
  }
}
