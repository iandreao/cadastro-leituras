import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { applySessionCookie, createSessionToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";

export async function POST(request: Request) {
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
    const usuario = await prisma.usuario.findUnique({
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
    });

    return applySessionCookie(
      NextResponse.json({
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
        },
      }),
      token,
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível entrar." },
      { status: 500 },
    );
  }
}
