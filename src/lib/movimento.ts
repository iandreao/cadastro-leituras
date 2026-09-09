import { randomUUID } from "node:crypto";
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
    const registro = await prisma.movimentoMensal.findUnique({
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
  console.log("[movimento] gravar MovimentoMensal", {
    condominioId,
    mes,
    ano,
    fechado,
  });

  try {
    return await prisma.movimentoMensal.upsert({
      where: {
        condominioId_mes_ano: { condominioId, mes, ano },
      },
      update: { fechado },
      create: { condominioId, mes, ano, fechado },
    });
  } catch (error) {
    console.error("[movimento] upsert indisponível, gravando via SQL", error);

    await prisma.$executeRaw`
      INSERT INTO "MovimentoMensal" ("id", "condominioId", "mes", "ano", "fechado", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${condominioId}, ${mes}, ${ano}, ${fechado}, NOW(), NOW())
      ON CONFLICT ("condominioId", "mes", "ano")
      DO UPDATE SET "fechado" = ${fechado}, "updatedAt" = NOW()
    `;

    return { condominioId, mes, ano, fechado };
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
