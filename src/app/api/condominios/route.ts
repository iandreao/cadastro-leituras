import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { garantirBlocoPadrao } from "@/lib/blocos-db";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { condominioSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const condominios = await prisma.condominio.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      unidades: {
        select: {
          _count: {
            select: { leituras: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    condominios.map(({ unidades, ...condominio }) => ({
      ...condominio,
      temLeitura: unidades.some((unidade) => unidade._count.leituras > 0),
    })),
  );
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = condominioSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const cnpj = onlyDigits(parsed.data.cnpj);
    const existente = await prisma.condominio.findUnique({ where: { cnpj } });

    if (existente) {
      return NextResponse.json(
        { error: "Este condomínio já está cadastrado." },
        { status: 409 },
      );
    }

    const condominio = await prisma.condominio.create({
      data: {
        cnpj,
        nome: toTitleCase(parsed.data.nome),
        endereco: toTitleCase(parsed.data.endereco),
        email: parsed.data.email.toLowerCase(),
        celular: onlyDigits(parsed.data.celular),
      },
    });

    await garantirBlocoPadrao(condominio.id);

    return NextResponse.json(condominio, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível incluir o condomínio." },
      { status: 500 },
    );
  }
}
