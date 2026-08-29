import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { despesaMensalSchema } from "@/lib/validations";

const includeDespesa = {
  condominio: {
    select: { id: true, nome: true },
  },
  tipoDespesa: {
    select: { id: true, nome: true },
  },
} as const;

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");
  const bloco = searchParams.has("bloco") ? searchParams.get("bloco") : null;

  const despesas = await prisma.despesaMensal.findMany({
    where: {
      ...(condominioId ? { condominioId } : {}),
      ...(bloco !== null ? { bloco } : {}),
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
    include: includeDespesa,
  });

  return NextResponse.json(despesas);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = despesaMensalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { condominioId, tipoDespesaId, bloco, mes, ano, valorTotal, formaCobranca } =
      parsed.data;
    const blocoNormalizado = bloco.trim();

    const [condominio, tipoDespesa] = await Promise.all([
      prisma.condominio.findUnique({ where: { id: condominioId } }),
      prisma.tipoDespesa.findUnique({ where: { id: tipoDespesaId } }),
    ]);

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (!tipoDespesa) {
      return NextResponse.json(
        { error: "Tipo de despesa não encontrado." },
        { status: 404 },
      );
    }

    const despesa = await prisma.despesaMensal.create({
      data: {
        condominioId,
        tipoDespesaId,
        bloco: blocoNormalizado,
        mes,
        ano,
        valorTotal,
        formaCobranca,
      },
      include: includeDespesa,
    });

    return NextResponse.json(despesa, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Já existe despesa deste tipo para o condomínio, bloco e mês/ano informados.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível cadastrar a despesa." },
      { status: 500 },
    );
  }
}
