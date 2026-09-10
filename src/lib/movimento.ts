import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { GESTOR_PADRAO_ID, ehSuperAdmin, escopoTenant } from "@/lib/multi-tenant";
import { getPrisma, prisma } from "@/lib/prisma";
import { inteiroPeriodo, marcarFechado } from "@/lib/periodo";

export const MENSAGEM_MES_FECHADO =
  "O movimento deste mês está fechado. Reabra o movimento na tela de Apuração para alterar lançamentos.";

export const MENSAGEM_COMPETENCIA_FECHADA =
  "Esta competência já se encontra fechada para lançamentos";

export type PeriodoFechado = {
  mes: number;
  ano: number;
};

async function resolverGestorIdDaCompetencia(
  session: SessionUser | null | undefined,
  condominioId: string,
) {
  const condominio = await getPrisma().condominio.findFirst({
    where: {
      id: condominioId,
      ...(session ? escopoTenant(session) : {}),
    },
    select: { gestorId: true },
  });

  if (session && !ehSuperAdmin(session)) {
    return session.gestorId?.trim() || condominio?.gestorId || null;
  }

  return condominio?.gestorId || session?.gestorId || null;
}

export async function verificarCompetenciaAberta(
  session: SessionUser | null | undefined,
  condominioId: string,
  mes: number | string,
  ano: number | string,
) {
  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);

  if (!condominioId || !Number.isInteger(mesN) || !Number.isInteger(anoN)) {
    return true;
  }

  const gestorId = await resolverGestorIdDaCompetencia(session, condominioId);

  if (!gestorId) {
    return true;
  }

  const trava = await getPrisma().movimentoMensal.findFirst({
    where: {
      gestorId,
      mes: mesN,
      ano: anoN,
      fechado: true,
    },
    select: { id: true },
  });

  return !trava;
}

export async function listarPeriodosFechados(
  condominioId: string,
  session?: SessionUser | null,
): Promise<PeriodoFechado[]> {
  try {
    const gestorId = await resolverGestorIdDaCompetencia(session, condominioId);

    if (!gestorId) {
      return [];
    }

    const linhas = await getPrisma().movimentoMensal.findMany({
      where: { gestorId, fechado: true },
      select: { mes: true, ano: true, fechado: true },
      distinct: ["mes", "ano"],
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
    });

    return linhas
      .filter((linha) => marcarFechado(linha.fechado))
      .map((linha) => ({
        mes: inteiroPeriodo(linha.mes),
        ano: inteiroPeriodo(linha.ano),
      }))
      .filter((linha) => Number.isInteger(linha.mes) && Number.isInteger(linha.ano));
  } catch (error) {
    console.error("[movimento] listarPeriodosFechados", error);
    return [];
  }
}

export async function movimentoEstaFechado(
  condominioId: string,
  mes: number | string,
  ano: number | string,
  session?: SessionUser | null,
) {
  return !(await verificarCompetenciaAberta(session, condominioId, mes, ano));
}

export async function definirMovimentoFechado(
  condominioId: string,
  mes: number,
  ano: number,
  fechado: boolean,
) {
  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);
  const condominio = await getPrisma().condominio.findUnique({
    where: { id: condominioId },
    select: { gestorId: true },
  });
  const gestorId = condominio?.gestorId?.trim() || GESTOR_PADRAO_ID;

  console.log("[movimento] gravar MovimentoMensal", {
    condominioId,
    gestorId,
    mes: mesN,
    ano: anoN,
    fechado,
  });

  await getPrisma().movimentoMensal.upsert({
    where: {
      mes_ano_gestorId: {
        mes: mesN,
        ano: anoN,
        gestorId,
      },
    },
    create: {
      condominioId,
      gestorId,
      mes: mesN,
      ano: anoN,
      fechado,
    },
    update: { fechado },
  });

  return { condominioId, gestorId, mes: mesN, ano: anoN, fechado };
}

export async function definirMovimentoTenant(
  gestorId: string,
  mes: number,
  ano: number,
  fechado: boolean,
) {
  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);
  const condominio = await getPrisma().condominio.findFirst({
    where: { gestorId },
    select: { id: true },
    orderBy: { nome: "asc" },
  });

  if (!condominio) {
    throw new Error(
      "Não há condomínio neste tenant para registrar o fechamento da competência.",
    );
  }

  return definirMovimentoFechado(condominio.id, mesN, anoN, fechado);
}

export async function falhaSeMovimentoFechado(
  session: SessionUser | null | undefined,
  condominioId: string,
  mes: number,
  ano: number,
) {
  if (!(await verificarCompetenciaAberta(session, condominioId, mes, ano))) {
    return {
      ok: false as const,
      error: MENSAGEM_COMPETENCIA_FECHADA,
      status: 403,
    };
  }

  return null;
}

export async function respostaSeMovimentoFechado(
  session: SessionUser | null | undefined,
  condominioId: string,
  mes: number,
  ano: number,
) {
  const falha = await falhaSeMovimentoFechado(session, condominioId, mes, ano);

  if (falha) {
    return NextResponse.json({ error: falha.error }, { status: falha.status });
  }

  return null;
}

export async function respostaSePeriodoUnidadeFechado(
  session: SessionUser | null | undefined,
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

  return respostaSeMovimentoFechado(session, unidade.condominioId, mes, ano);
}
