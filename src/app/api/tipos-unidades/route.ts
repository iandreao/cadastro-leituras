import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { tipoUnidadeSchema } from "@/lib/validations";

const includeTipo = {
  bloco: {
    select: { id: true, nome: true },
  },
  _count: {
    select: { unidades: true, regras: true },
  },
} as const;

async function removerUnicoAntigoPorNomeECondominio() {
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoUnidade_nome_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoUnidade_nome_condominioId_key"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TipoUnidade" DROP CONSTRAINT IF EXISTS "TipoUnidade_nome_key"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TipoUnidade" DROP CONSTRAINT IF EXISTS "TipoUnidade_nome_condominioId_key"`,
  );
}

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const params = new URL(request.url).searchParams;
  const condominioId = params.get("condominioId")?.trim();

  if (!condominioId) {
    return NextResponse.json(
      { error: "Selecione o condomínio." },
      { status: 400 },
    );
  }

  const blocoId = params.get("blocoId")?.trim();

  if (!blocoId) {
    return NextResponse.json(
      { error: "Selecione o bloco/torre." },
      { status: 400 },
    );
  }

  const tipos = await prisma.tipoUnidade.findMany({
    where: { condominioId, blocoId },
    orderBy: { nome: "asc" },
    include: includeTipo,
  });

  return NextResponse.json(tipos);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = tipoUnidadeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const data = {
      nome: parsed.data.nome.trim(),
      condominioId: parsed.data.condominioId,
      blocoId: parsed.data.blocoId.trim(),
    };

    const resolvido = await resolverBlocoDoCondominio(
      data.condominioId,
      data.blocoId,
    );

    if (resolvido.error) {
      return NextResponse.json({ error: resolvido.error }, { status: 400 });
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: data.condominioId },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    await removerUnicoAntigoPorNomeECondominio();

    const existente = await prisma.tipoUnidade.findFirst({
      where: {
        nome: data.nome,
        condominioId: data.condominioId,
        blocoId: data.blocoId,
      },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Já existe um tipo de unidade com este nome neste condomínio e bloco." },
        { status: 409 },
      );
    }

    const tipo = await prisma.tipoUnidade.create({
      data: {
        nome: data.nome,
        condominioId: data.condominioId,
        blocoId: data.blocoId,
      },
      include: includeTipo,
    });

    return NextResponse.json(tipo, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar o tipo de unidade." },
      { status: 500 },
    );
  }
}
