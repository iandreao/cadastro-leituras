import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  exigirAmbienteAuth,
  repositorioUsuario,
  responderErroAuth,
} from "@/lib/auth-api";
import { applySessionCookie, createSessionToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ambiente = exigirAmbienteAuth();

  if (ambiente) {
    return ambiente;
  }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const usuario = await (await repositorioUsuario()).findUnique({
      where: { email },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 },
      );
    }

    const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senha);

    if (!senhaOk) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role ?? "OPERADOR",
      gestorId: usuario.gestorId ?? null,
    });

    return applySessionCookie(
      NextResponse.json({
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role ?? "OPERADOR",
          gestorId: usuario.gestorId ?? null,
        },
      }),
      token,
    );
  } catch (error) {
    return responderErroAuth(error);
  }
}
