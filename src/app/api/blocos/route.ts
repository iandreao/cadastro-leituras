import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  criarBloco,
  listarBlocosPorCondominio,
  nomeBlocoDuplicado,
} from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { blocoCadastroSchema } from "@/lib/validations";

function idTexto(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const condominioId = idTexto(
    new URL(request.url).searchParams.get("condominioId"),
  );

  if (!condominioId) {
    return NextResponse.json(
      { error: "Selecione o condomínio." },
      { status: 400 },
    );
  }

  const blocos = await listarBlocosPorCondominio(condominioId);

  return NextResponse.json(blocos);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = blocoCadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const nome = parsed.data.nome.trim();
    const condominioId = idTexto(parsed.data.condominioId);

    const condominio = await prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { id: true },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (await nomeBlocoDuplicado(condominio.id, nome)) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    const bloco = await criarBloco(condominio.id, nome);

    return NextResponse.json(bloco, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      return NextResponse.json(
        { error: "O condomínio informado não é válido para cadastrar o bloco." },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json(
        {
          error:
            "A tabela de blocos ainda não está sincronizada no banco. Rode o seed e o prisma db push.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível cadastrar o bloco/torre." },
      { status: 500 },
    );
  }
}
