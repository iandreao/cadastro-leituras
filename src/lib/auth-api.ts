import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { normalizarDatabaseUrl } from "@/lib/neon-url";
import { getPrisma } from "@/lib/prisma";

export function exigirAmbienteAuth() {
  const databaseUrl = process.env.DATABASE_URL
    ? normalizarDatabaseUrl(process.env.DATABASE_URL)
    : "";

  if (!databaseUrl) {
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

export async function repositorioUsuario() {
  const cliente = getPrisma() as { usuario?: { findUnique?: unknown } };

  if (!cliente.usuario?.findUnique) {
    throw new Error(
      "Prisma Client sem o model Usuario. Confira o prisma generate no build da Vercel.",
    );
  }

  return getPrisma().usuario;
}

function sanitizarTexto(valor: string) {
  return valor.replace(/postgresql:\/\/\S+/gi, "[DATABASE_URL]");
}

export function responderErroAuth(error: unknown) {
  console.error("[auth]", error);

  const nome = error instanceof Error ? error.name : "Error";
  const codigo =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const message = sanitizarTexto(
    error instanceof Error ? error.message : String(error),
  );
  const stack = sanitizarTexto(
    error instanceof Error ? error.stack ?? "" : "",
  );

  return NextResponse.json(
    {
      error: message,
      name: nome,
      code: codigo,
      stack,
    },
    { status: 500 },
  );
}
