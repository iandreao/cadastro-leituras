import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { applySessionCookie, createSessionToken } from "@/lib/auth";
import { cadastroSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = cadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { nome, email, senha } = parsed.data;
    const emailNormalizado = email.toLowerCase();

    const existente = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Já existe uma conta com este e-mail." },
        { status: 409 },
      );
    }

    const hash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email: emailNormalizado,
        senha: hash,
      },
    });

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
      { error: "Não foi possível concluir o cadastro." },
      { status: 500 },
    );
  }
}
