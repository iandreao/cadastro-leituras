import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

export const TAG_CONDOMINIOS = "cadastro-condominios";
export const TAG_BLOCOS = "cadastro-blocos";
export const TAG_UNIDADES = "cadastro-unidades";

export function invalidarCacheCadastro() {
  revalidateTag(TAG_CONDOMINIOS, "max");
  revalidateTag(TAG_BLOCOS, "max");
  revalidateTag(TAG_UNIDADES, "max");
}

export const listarCondominiosResumo = unstable_cache(
  async () =>
    prisma.condominio.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ["condominios-resumo"],
  { tags: [TAG_CONDOMINIOS], revalidate: 60 },
);

export const listarBlocosResumo = unstable_cache(
  async () =>
    prisma.bloco.findMany({
      select: { id: true, nome: true, condominioId: true },
      orderBy: { nome: "asc" },
    }),
  ["blocos-resumo"],
  { tags: [TAG_BLOCOS], revalidate: 60 },
);

export const listarUnidadesLeitura = unstable_cache(
  async (condominioId: string) =>
    prisma.unidade.findMany({
      where: { condominioId },
      orderBy: [{ bloco: { nome: "asc" } }, { numero: "asc" }],
      select: {
        id: true,
        numero: true,
        tipoConsumo: true,
        condominioId: true,
        tipoUnidade: { select: { id: true, nome: true } },
        bloco: { select: { id: true, nome: true } },
      },
    }),
  ["unidades-leitura"],
  { tags: [TAG_UNIDADES], revalidate: 30 },
);
