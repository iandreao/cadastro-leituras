import { NextResponse } from "next/server";
import { getPrisma, prisma } from "@/lib/prisma";
import { inteiroPeriodo, marcarFechado } from "@/lib/periodo";

export const MENSAGEM_MES_FECHADO =
  "O movimento deste mês está fechado. Reabra o movimento na tela de Apuração para alterar lançamentos.";

export type PeriodoFechado = {
  mes: number;
  ano: number;
};

async function buscarMovimentoSql(
  condominioId: string,
  mes: number,
  ano: number,
) {
  return getPrisma().$queryRaw<Array<{ fechado: unknown; mes: number; ano: number }>>`
    SELECT "fechado", "mes", "ano"
    FROM "MovimentoMensal"
    WHERE "condominioId" = ${condominioId}
      AND "mes" = ${mes}
      AND "ano" = ${ano}
    LIMIT 1
  `;
}

export async function listarPeriodosFechados(
  condominioId: string,
): Promise<PeriodoFechado[]> {
  try {
    const linhas = await getPrisma().$queryRaw<
      Array<{ mes: number; ano: number; fechado: unknown }>
    >`
      SELECT "mes", "ano", "fechado"
      FROM "MovimentoMensal"
      WHERE "condominioId" = ${condominioId}
        AND "fechado" = true
      ORDER BY "ano" DESC, "mes" DESC
    `;

    return (linhas ?? [])
      .filter((linha) => marcarFechado(linha.fechado))
      .map((linha) => ({
        mes: inteiroPeriodo(linha.mes),
        ano: inteiroPeriodo(linha.ano),
      }))
      .filter((linha) => Number.isInteger(linha.mes) && Number.isInteger(linha.ano));
  } catch (error) {
    console.error("[movimento] listarPeriodosFechados SQL", error);
    return [];
  }
}

export async function movimentoEstaFechado(
  condominioId: string,
  mes: number | string,
  ano: number | string,
) {
  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);

  if (!condominioId || !Number.isInteger(mesN) || !Number.isInteger(anoN)) {
    return false;
  }

  try {
    const linhas = await buscarMovimentoSql(condominioId, mesN, anoN);
    if (linhas?.length) {
      return marcarFechado(linhas[0]?.fechado);
    }
  } catch (error) {
    console.error("[movimento] consulta SQL de fechamento", error);
  }

  return false;
}

export async function definirMovimentoFechado(
  condominioId: string,
  mes: number,
  ano: number,
  fechado: boolean,
) {
  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);

  console.log("[movimento] gravar MovimentoMensal", {
    condominioId,
    mes: mesN,
    ano: anoN,
    fechado,
  });

  await getPrisma().$executeRaw`
    INSERT INTO "MovimentoMensal" ("id", "condominioId", "mes", "ano", "fechado", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${condominioId}, ${mesN}, ${anoN}, ${fechado}, NOW(), NOW())
    ON CONFLICT ("condominioId", "mes", "ano")
    DO UPDATE SET "fechado" = ${fechado}, "updatedAt" = NOW()
  `;

  return { condominioId, mes: mesN, ano: anoN, fechado };
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
