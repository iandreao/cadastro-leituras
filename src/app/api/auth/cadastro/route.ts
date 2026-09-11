import { NextResponse } from "next/server";
import {
  exigirAmbienteAuth,
  repositorioUsuario,
  responderErroAuth,
} from "@/lib/auth-api";
import { applySessionCookie, createSessionToken } from "@/lib/auth";
import { hashSenha } from "@/lib/senha";
import { cadastroSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ambiente = exigirAmbienteAuth();

  if (ambiente) {
    return ambiente;
  }

  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      delete (body as { gestorId?: unknown }).gestorId;
      delete (body as { role?: unknown }).role;
    }
    const parsed = cadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { nome, email, senha } = parsed.data;
    const emailNormalizado = email.toLowerCase();
    const { GESTOR_PADRAO_ID, garantirTenantPadrao } = await import(
      "@/lib/multi-tenant"
    );
    await garantirTenantPadrao();
    const usuarios = await repositorioUsuario();

    const existente = await usuarios.findUnique({
      where: { email: emailNormalizado },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Já existe uma conta com este e-mail." },
        { status: 409 },
      );
    }

    const hash = await hashSenha(senha);
    const usuario = await usuarios.create({
      data: {
        nome,
        email: emailNormalizado,
        senha: hash,
        ativo: true,
        gestorId: GESTOR_PADRAO_ID,
      },
    });

    const token = await createSessionToken({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role ?? "OPERADOR",
      gestorId: usuario.gestorId ?? GESTOR_PADRAO_ID,
    });

    return applySessionCookie(
      NextResponse.json({
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role ?? "OPERADOR",
          gestorId: usuario.gestorId ?? GESTOR_PADRAO_ID,
        },
      }),
      token,
    );
  } catch (error) {
    return responderErroAuth(error);
  }
}
