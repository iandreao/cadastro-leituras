import { prisma } from "@/lib/prisma";

export function invalidarCacheCadastro() {
  // Sem cache de servidor: as telas recarregam via API no cliente.
}

export async function listarCondominiosResumo() {
  return prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export async function listarBlocosResumo() {
  return prisma.bloco.findMany({
    select: { id: true, nome: true, condominioId: true },
    orderBy: { nome: "asc" },
  });
}

export async function listarUnidadesLeitura(condominioId: string) {
  return prisma.unidade.findMany({
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
  });
}
