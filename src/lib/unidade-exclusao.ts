import { Prisma } from "@prisma/client";
import { exclusaoUnidadeBloqueada } from "@/lib/unidades";
import { getPrisma } from "@/lib/prisma";

type ContagemLinha = {
  unidadeId: string;
  n: number;
};

async function contarPorTabela(tabela: "LeituraAgua" | "LeituraGas", ids: string[]) {
  const mapa = new Map<string, number>();

  if (ids.length === 0) {
    return mapa;
  }

  try {
    const linhas =
      tabela === "LeituraAgua"
        ? await getPrisma().$queryRaw<ContagemLinha[]>`
            SELECT "unidadeId", COUNT(*)::int AS n
            FROM "LeituraAgua"
            WHERE "unidadeId" IN (${Prisma.join(ids)})
            GROUP BY "unidadeId"
          `
        : await getPrisma().$queryRaw<ContagemLinha[]>`
            SELECT "unidadeId", COUNT(*)::int AS n
            FROM "LeituraGas"
            WHERE "unidadeId" IN (${Prisma.join(ids)})
            GROUP BY "unidadeId"
          `;

    for (const linha of linhas ?? []) {
      mapa.set(linha.unidadeId, Number(linha.n) || 0);
    }
  } catch {
    // Tabela pode não existir neste schema.
  }

  return mapa;
}

export const includeContagemExclusaoUnidade = {
  _count: {
    select: {
      leituras: true,
      faturas: true,
    },
  },
} as const;

export async function marcarBloqueioExclusaoUnidades<
  T extends {
    id: string;
    _count?: { leituras?: number; faturas?: number };
  },
>(unidades: T[]) {
  const ids = unidades.map((item) => item.id);
  const [agua, gas] = await Promise.all([
    contarPorTabela("LeituraAgua", ids),
    contarPorTabela("LeituraGas", ids),
  ]);

  return unidades.map((item) => ({
    ...item,
    exclusaoBloqueada: exclusaoUnidadeBloqueada({
      _count: {
        leituras: item._count?.leituras ?? 0,
        faturas: item._count?.faturas ?? 0,
        leiturasAgua: agua.get(item.id) ?? 0,
        leiturasGas: gas.get(item.id) ?? 0,
      },
    }),
  }));
}

export async function unidadeTemVinculoDeExclusao(id: string) {
  const unidade = await getPrisma().unidade.findUnique({
    where: { id },
    select: {
      id: true,
      ...includeContagemExclusaoUnidade,
    },
  });

  if (!unidade) {
    return false;
  }

  const [marcada] = await marcarBloqueioExclusaoUnidades([unidade]);
  return marcada.exclusaoBloqueada;
}
