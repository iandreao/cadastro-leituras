import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { includeTipoUnidade } from "@/lib/unidades";
import { unidadeLoteSchema, unidadeSchema } from "@/lib/validations";

const includeUnidade = {
  condominio: {
    select: { id: true, nome: true },
  },
  ...includeTipoUnidade,
} as const;

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");

  const unidades = await prisma.unidade.findMany({
    where: condominioId ? { condominioId } : undefined,
    orderBy: [{ bloco: { nome: "asc" } }, { numero: "asc" }],
    include: {
      ...includeUnidade,
      _count: {
        select: { leituras: true },
      },
    },
  });

  return NextResponse.json(unidades);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = (await request.json()) as { numeros?: unknown };

    if (Array.isArray(body.numeros)) {
      return criarLote(body);
    }

    const parsed = unidadeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: parsed.data.condominioId },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    const resolvido = await resolverBlocoDoCondominio(
      parsed.data.condominioId,
      parsed.data.blocoId,
    );

    if (resolvido.error) {
      return NextResponse.json({ error: resolvido.error }, { status: 400 });
    }

    const { blocoId } = resolvido;

    const tipoUnidade = await prisma.tipoUnidade.findUnique({
      where: { id: parsed.data.tipoUnidadeId },
    });

    if (!tipoUnidade) {
      return NextResponse.json(
        { error: "Tipo de unidade não encontrado." },
        { status: 404 },
      );
    }

    if (tipoUnidade.condominioId !== parsed.data.condominioId) {
      return NextResponse.json(
        { error: "O tipo de unidade não pertence ao condomínio selecionado." },
        { status: 400 },
      );
    }

    if (tipoUnidade.blocoId !== blocoId) {
      return NextResponse.json(
        { error: "O tipo de unidade não pertence ao bloco selecionado." },
        { status: 400 },
      );
    }

    const numero = parsed.data.numero.trim();
    const existente = await prisma.unidade.findUnique({
      where: {
        condominioId_blocoId_numero: {
          condominioId: parsed.data.condominioId,
          blocoId,
          numero,
        },
      },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Esta unidade já está cadastrada neste condomínio." },
        { status: 409 },
      );
    }

    const unidade = await prisma.unidade.create({
      data: {
        numero,
        nomeMorador: toTitleCase(parsed.data.nomeMorador),
        celular: onlyDigits(parsed.data.celular),
        tipoUnidadeId: parsed.data.tipoUnidadeId,
        tipoConsumo: parsed.data.tipoConsumo,
        blocoId,
        condominioId: parsed.data.condominioId,
      },
      include: includeUnidade,
    });

    return NextResponse.json(unidade, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível incluir a unidade." },
      { status: 500 },
    );
  }
}

async function criarLote(body: unknown) {
  const parsed = unidadeLoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const condominio = await prisma.condominio.findUnique({
    where: { id: parsed.data.condominioId },
  });

  if (!condominio) {
    return NextResponse.json(
      { error: "Condomínio não encontrado." },
      { status: 404 },
    );
  }

  const resolvido = await resolverBlocoDoCondominio(
    parsed.data.condominioId,
    parsed.data.blocoId,
  );

  if (resolvido.error) {
    return NextResponse.json({ error: resolvido.error }, { status: 400 });
  }

  const { blocoId } = resolvido;

  const tipoUnidade = await prisma.tipoUnidade.findUnique({
    where: { id: parsed.data.tipoUnidadeId },
  });

  if (!tipoUnidade) {
    return NextResponse.json(
      { error: "Tipo de unidade não encontrado." },
      { status: 404 },
    );
  }

  if (tipoUnidade.condominioId !== parsed.data.condominioId) {
    return NextResponse.json(
      { error: "O tipo de unidade não pertence ao condomínio selecionado." },
      { status: 400 },
    );
  }

  if (tipoUnidade.blocoId !== blocoId) {
    return NextResponse.json(
      { error: "O tipo de unidade não pertence ao bloco selecionado." },
      { status: 400 },
    );
  }

  const numeros = [...new Set(parsed.data.numeros)];

  await prisma.unidade.createMany({
    data: numeros.map((numero) => ({
      numero,
      nomeMorador: "",
      celular: "",
      tipoUnidadeId: parsed.data.tipoUnidadeId,
      tipoConsumo: parsed.data.tipoConsumo,
      blocoId,
      condominioId: parsed.data.condominioId,
    })),
    skipDuplicates: true,
  });

  const criadas = await prisma.unidade.findMany({
    where: {
      condominioId: parsed.data.condominioId,
      blocoId,
      numero: { in: numeros },
    },
    include: includeUnidade,
    orderBy: { numero: "asc" },
  });

  return NextResponse.json({ criadas }, { status: 201 });
}
