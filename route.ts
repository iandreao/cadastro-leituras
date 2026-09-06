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

function tabelaBlocoDisponivel() {
  return Boolean(
    (prisma as { bloco?: { findMany?: unknown } }).bloco?.findMany,
  );
}

function respostaErroPrisma(error: unknown, fallback: string) {
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

  if (error instanceof TypeError) {
    return NextResponse.json(
      {
        error:
          "O cliente Prisma não encontrou o model Bloco. Confira o prisma generate no build da Vercel.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}

async function exigirSessao(request: Request) {
  if (!request) {
    return NextResponse.json({ error: "Dados ausentes" }, { status: 400 });
  }

  const sessao = await requireApiSession(request);

  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (sessao.error) {
    return sessao.error;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const bloqueio = await exigirSessao(request);

    if (bloqueio) {
      return bloqueio;
    }

    const condominioId = idTexto(
      request.url
        ? new URL(request.url).searchParams.get("condominioId")
        : "",
    );

    if (!condominioId) {
      return NextResponse.json(
        { error: "Dados ausentes. Selecione o condomínio." },
        { status: 400 },
      );
    }

    if (!prisma?.condominio?.findUnique) {
      return NextResponse.json(
        { error: "Dados ausentes no cliente Prisma." },
        { status: 500 },
      );
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { id: true },
    });

    if (!condominio?.id) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (!tabelaBlocoDisponivel()) {
      return NextResponse.json(
        {
          error:
            "O model Bloco não está disponível. Rode prisma generate e sincronize o banco.",
        },
        { status: 500 },
      );
    }

    const blocos = await listarBlocosPorCondominio(condominio.id);

    return NextResponse.json(Array.isArray(blocos) ? blocos : []);
  } catch (error) {
    return respostaErroPrisma(error, "Não foi possível listar os blocos.");
  }
}

export async function POST(request: Request) {
  try {
    const bloqueio = await exigirSessao(request);

    if (bloqueio) {
      return bloqueio;
    }

    if (!request) {
      return NextResponse.json({ error: "Dados ausentes" }, { status: 400 });
    }

    let body: unknown = null;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dados ausentes" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dados ausentes" }, { status: 400 });
    }

    const parsed = blocoCadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const nome = parsed.data.nome.trim();
    const condominioId = idTexto(parsed.data.condominioId);

    if (!nome || !condominioId) {
      return NextResponse.json({ error: "Dados ausentes" }, { status: 400 });
    }

    if (!prisma?.condominio?.findUnique) {
      return NextResponse.json(
        { error: "Dados ausentes no cliente Prisma." },
        { status: 500 },
      );
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { id: true },
    });

    if (!condominio?.id) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (!tabelaBlocoDisponivel()) {
      return NextResponse.json(
        {
          error:
            "O model Bloco não está disponível. Rode prisma generate e sincronize o banco.",
        },
        { status: 500 },
      );
    }

    if (await nomeBlocoDuplicado(condominio.id, nome)) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    const bloco = await criarBloco(condominio.id, nome);

    if (!bloco) {
      return NextResponse.json({ error: "Dados ausentes" }, { status: 500 });
    }

    return NextResponse.json(bloco, { status: 201 });
  } catch (error) {
    return respostaErroPrisma(
      error,
      "Não foi possível cadastrar o bloco/torre.",
    );
  }
}
