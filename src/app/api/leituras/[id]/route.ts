import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { leituraSchema } from "@/lib/validations";
import { validarLeituraUnidade } from "@/lib/leitura-regras";
import { respostaSePeriodoUnidadeFechado } from "@/lib/movimento";

type RouteContext = { params: Promise<{ id: string }> };

const includeUnidade = {
  unidade: {
    select: {
      id: true,
      numero: true,
      blocoId: true,
      bloco: {
        select: { id: true, nome: true },
      },
      tipoUnidade: {
        select: { id: true, nome: true },
      },
      tipoConsumo: true,
      nomeMorador: true,
      condominioId: true,
      condominio: {
        select: { id: true, nome: true },
      },
    },
  },
} as const;

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = leituraSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.leitura.findUnique({ where: { id } });

    if (!atual) {
      return NextResponse.json(
        { error: "Leitura não encontrada." },
        { status: 404 },
      );
    }

    const bloqueadoAtual = await respostaSePeriodoUnidadeFechado(
      atual.unidadeId,
      atual.mes,
      atual.ano,
    );

    if (bloqueadoAtual) {
      return bloqueadoAtual;
    }

    const bloqueadoNovo = await respostaSePeriodoUnidadeFechado(
      parsed.data.unidadeId,
      parsed.data.mes,
      parsed.data.ano,
    );

    if (bloqueadoNovo) {
      return bloqueadoNovo;
    }

    const validado = await validarLeituraUnidade({
      ...parsed.data,
      ignorarId: id,
    });

    if (validado.error) {
      return validado.error;
    }

    const outra = await prisma.leitura.findUnique({
      where: {
        unidadeId_mes_ano: {
          unidadeId: parsed.data.unidadeId,
          mes: parsed.data.mes,
          ano: parsed.data.ano,
        },
      },
    });

    if (outra && outra.id !== id) {
      return NextResponse.json(
        { error: "Já existe leitura para esta unidade nesta referência." },
        { status: 409 },
      );
    }

    const leitura = await prisma.leitura.update({
      where: { id },
      data: {
        unidadeId: parsed.data.unidadeId,
        mes: parsed.data.mes,
        ano: parsed.data.ano,
        valorAgua: validado.valorAgua,
        valorGas: validado.valorGas,
      },
      include: includeUnidade,
    });

    return NextResponse.json(leitura);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar a leitura." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;
  const leitura = await prisma.leitura.findUnique({ where: { id } });

  if (!leitura) {
    return NextResponse.json(
      { error: "Leitura não encontrada." },
      { status: 404 },
    );
  }

  const bloqueado = await respostaSePeriodoUnidadeFechado(
    leitura.unidadeId,
    leitura.mes,
    leitura.ano,
  );

  if (bloqueado) {
    return bloqueado;
  }

  await prisma.leitura.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
