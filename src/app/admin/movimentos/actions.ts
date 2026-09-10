"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { nomeMes } from "@/lib/leituras";
import {
  definirMovimentoTenant,
} from "@/lib/movimento";
import {
  ehSuperAdmin,
  resolverGestorIdDeCadastro,
} from "@/lib/multi-tenant";
import { inteiroPeriodo, periodoBrasil } from "@/lib/periodo";

export type CompetenciaLista = {
  mes: number;
  ano: number;
  rotuloMes: string;
  fechado: boolean;
  atual: boolean;
};

export type ResultadoMovimento = { ok: true } | { error: string };

const MESES_VISIVEIS = 24;

async function exigirGestorOuSuperAdmin() {
  const session = await getSession();

  if (!session) {
    return { error: "Não autenticado." as const, session: null };
  }

  if (session.role !== "SUPER_ADMIN" && session.role !== "GESTOR_ADMIN") {
    return {
      error: "Acesso restrito ao gestor da administradora." as const,
      session: null,
    };
  }

  return { error: null, session };
}

function montarCompetencias(
  fechados: Array<{ mes: number; ano: number }>,
): CompetenciaLista[] {
  const { mes: mesAtual, ano: anoAtual } = periodoBrasil();
  const chaves = new Set(
    fechados.map((item) => `${item.ano}-${item.mes}`),
  );
  const itens: CompetenciaLista[] = [];
  const indiceAtual = anoAtual * 12 + (mesAtual - 1);

  for (let i = 0; i < MESES_VISIVEIS; i += 1) {
    const indice = indiceAtual - i;
    const ano = Math.floor(indice / 12);
    const mes = (indice % 12) + 1;

    itens.push({
      mes,
      ano,
      rotuloMes: nomeMes(mes),
      fechado: chaves.has(`${ano}-${mes}`),
      atual: mes === mesAtual && ano === anoAtual,
    });
  }

  return itens.sort((a, b) => b.ano - a.ano || b.mes - a.mes);
}

export async function obterPerfilMovimentos() {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return {
      autorizado: false as const,
      role: null as "SUPER_ADMIN" | "GESTOR_ADMIN" | null,
      error: acesso.error,
    };
  }

  return {
    autorizado: true as const,
    role: acesso.session.role as "SUPER_ADMIN" | "GESTOR_ADMIN",
    error: null,
  };
}

export async function listarCompetencias(
  gestorIdCliente?: string,
): Promise<CompetenciaLista[]> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return [];
  }

  const gestorId = await resolverGestorIdDeCadastro(
    acesso.session,
    gestorIdCliente,
  );

  if (!gestorId) {
    return montarCompetencias([]);
  }

  const fechados = await getPrisma().movimentoMensal.findMany({
    where: { gestorId, fechado: true },
    select: { mes: true, ano: true },
    distinct: ["mes", "ano"],
  });

  return montarCompetencias(fechados);
}

export async function alterarCompetencia(
  mes: number,
  ano: number,
  fechado: boolean,
  gestorIdCliente?: string,
): Promise<ResultadoMovimento> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return { error: acesso.error ?? "Não autenticado." };
  }

  if (!fechado && acesso.session.role !== "GESTOR_ADMIN" && !ehSuperAdmin(acesso.session)) {
    return {
      error: "Apenas o gestor da administradora pode reabrir a competência.",
    };
  }

  const mesN = inteiroPeriodo(mes);
  const anoN = inteiroPeriodo(ano);

  if (
    !Number.isInteger(mesN) ||
    mesN < 1 ||
    mesN > 12 ||
    !Number.isInteger(anoN) ||
    anoN < 2000
  ) {
    return { error: "Competência inválida." };
  }

  const gestorId = await resolverGestorIdDeCadastro(
    acesso.session,
    gestorIdCliente,
  );

  if (!gestorId) {
    return { error: "Gestor não identificado para o fechamento." };
  }

  try {
    await definirMovimentoTenant(gestorId, mesN, anoN, fechado);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a competência.",
    };
  }

  revalidatePath("/admin/movimentos");
  return { ok: true };
}
