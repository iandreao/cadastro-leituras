import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export function exigirAmbienteAuth() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL não está configurado no ambiente Production da Vercel.",
      },
      { status: 500 },
    );
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    return NextResponse.json(
      {
        error:
          "AUTH_SECRET não está configurado no ambiente Production da Vercel.",
      },
      { status: 500 },
    );
  }

  return null;
}

export function repositorioUsuario() {
  const cliente = getPrisma() as { usuario?: { findUnique?: unknown } };

  if (!cliente.usuario?.findUnique) {
    throw new Error(
      "Prisma Client sem o model Usuario. Confira o prisma generate no build da Vercel.",
    );
  }

  return getPrisma().usuario;
}

function sanitizarMensagem(error: unknown) {
  const bruto = error instanceof Error ? error.message : String(error);
  return bruto.replace(/postgresql:\/\/\S+/gi, "[DATABASE_URL]");
}

export function responderErroAuth(error: unknown, fallback: string) {
  console.error("[auth]", error);
  const detalhe = sanitizarMensagem(error);

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  ) {
    return NextResponse.json(
      { error: "A tabela de usuários não existe neste banco." },
      { status: 500 },
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P1017")
  ) {
    return NextResponse.json(
      { error: "Não foi possível conectar ao banco de dados." },
      { status: 500 },
    );
  }

  if (detalhe.includes("AUTH_SECRET")) {
    return NextResponse.json(
      {
        error:
          "AUTH_SECRET não está configurado no ambiente Production da Vercel.",
      },
      { status: 500 },
    );
  }

  if (detalhe.includes("DATABASE_URL")) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL não está configurado no ambiente Production da Vercel.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: fallback, detalhe }, { status: 500 });
}
