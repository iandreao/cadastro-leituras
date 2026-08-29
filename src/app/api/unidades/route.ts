import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { unidadeLoteSchema, unidadeSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");

  const unidades = await prisma.unidade.findMany({
    where: condominioId ? { condominioId } : undefined,
    orderBy: [{ bloco: "asc" }, { numero: "asc" }],
    include: {
      condominio: {
        select: { id: true, nome: true },
      },
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

    const bloco = parsed.data.bloco.trim();
    const numero = parsed.data.numero.trim();
    const existente = await prisma.unidade.findUnique({
      where: {
        condominioId_bloco_numero: {
          condominioId: parsed.data.condominioId,
          bloco,
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
        tipoUnidade: parsed.data.tipoUnidade,
        tipoConsumo: parsed.data.tipoConsumo,
        bloco,
        condominioId: parsed.data.condominioId,
      },
      include: {
        condominio: {
          select: { id: true, nome: true },
        },
      },
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

  const bloco = parsed.data.bloco.trim();
  const numeros = [...new Set(parsed.data.numeros)];

  await prisma.unidade.createMany({
    data: numeros.map((numero) => ({
      numero,
      nomeMorador: "",
      celular: "",
      tipoUnidade: parsed.data.tipoUnidade,
      tipoConsumo: parsed.data.tipoConsumo,
      bloco,
      condominioId: parsed.data.condominioId,
    })),
    skipDuplicates: true,
  });

  const criadas = await prisma.unidade.findMany({
    where: {
      condominioId: parsed.data.condominioId,
      bloco,
      numero: { in: numeros },
    },
    include: {
      condominio: {
        select: { id: true, nome: true },
      },
    },
    orderBy: { numero: "asc" },
  });

  return NextResponse.json({ criadas }, { status: 201 });
}
