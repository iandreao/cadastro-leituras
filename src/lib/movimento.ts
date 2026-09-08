import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const MENSAGEM_MES_FECHADO =
  "O movimento deste mês está fechado. Reabra o movimento na tela de Apuração para alterar lançamentos.";

export type PeriodoFechado = {
  mes: number;
  ano: number;
};

export async function listarPeriodosFechados(condominioId: string) {
  try {
    const periodos = await prisma.movimentoMensal.findMany({
      where: { condominioId, fechado: true },
      select: { mes: true, ano: true },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
    });

    return periodos ?? [];
  } catch (error) {
    console.error("[movimento] listarPeriodosFechados", error);
    return [];
  }
}

export async function movimentoEstaFechado(
  condominioId: string,
  mes: number,
  ano: number,
) {
  try {
    const repositorio = (
      prisma as {
        movimentoMensal?: {
          findUnique: (args: {
            where: {
              condominioId_mes_ano: {
                condominioId: string;
                mes: number;
                ano: number;
              };
            };
            select: { fechado: true };
          }) => Promise<{ fechado: boolean } | null>;
        };
      }
    ).movimentoMensal;

    if (!repositorio?.findUnique) {
      return false;
    }

    const registro = await repositorio.findUnique({
      where: {
        condominioId_mes_ano: { condominioId, mes, ano },
      },
      select: { fechado: true },
    });

    return Boolean(registro?.fechado);
  } catch {
    return false;
  }
}

export async function definirMovimentoFechado(
  condominioId: string,
  mes: number,
  ano: number,
  fechado: boolean,
) {
  try {
    const existente = await prisma.movimentoMensal.findFirst({
      where: { condominioId, mes, ano },
      select: { id: true },
    });

    if (existente?.id) {
      return await prisma.movimentoMensal.update({
        where: { id: existente.id },
        data: { fechado },
      });
    }

    return await prisma.movimentoMensal.create({
      data: { condominioId, mes, ano, fechado },
    });
  } catch (error) {
    console.error("[movimento] definirMovimentoFechado", {
      condominioId,
      mes,
      ano,
      fechado,
      error,
    });

    try {
      return await prisma.movimentoMensal.upsert({
        where: {
          condominioId_mes_ano: { condominioId, mes, ano },
        },
        update: { fechado },
        create: { condominioId, mes, ano, fechado },
      });
    } catch (fallbackError) {
      const mensagem =
        fallbackError instanceof Error && fallbackError.message
          ? fallbackError.message
          : error instanceof Error && error.message
            ? error.message
            : "Não foi possível gravar o movimento do mês.";
      throw new Error(mensagem);
    }
  }
}

export async function falhaSeMovimentoFechado(
  condominioId: string,
  mes: number,
  ano: number,
) {
  if (await movimentoEstaFechado(condominioId, mes, ano)) {
    return {
      ok: false as const,
      error: MENSAGEM_MES_FECHADO,
      status: 409,
    };
  }

  return null;
}

export async function respostaSeMovimentoFechado(
  condominioId: string,
  mes: number,
  ano: number,
) {
  const falha = await falhaSeMovimentoFechado(condominioId, mes, ano);

  if (falha) {
    return NextResponse.json({ error: falha.error }, { status: falha.status });
  }

  return null;
}

export async function respostaSePeriodoUnidadeFechado(
  unidadeId: string,
  mes: number,
  ano: number,
) {
  const unidade = await prisma.unidade.findUnique({
    where: { id: unidadeId },
    select: { condominioId: true },
  });

  if (!unidade) {
    return NextResponse.json(
      { error: "Unidade não encontrada." },
      { status: 404 },
    );
  }

  return respostaSeMovimentoFechado(unidade.condominioId, mes, ano);
}
