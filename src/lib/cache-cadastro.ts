import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoTenant, viaCondominio } from "@/lib/multi-tenant";

export function invalidarCacheCadastro() {
  // Sem cache de servidor: as telas recarregam via API no cliente.
}

export async function listarCondominiosResumo(session: SessionUser) {
  return prisma.condominio.findMany({
    where: escopoTenant(session),
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export async function listarBlocosResumo(session: SessionUser) {
  return prisma.bloco.findMany({
    where: viaCondominio(session),
    select: { id: true, nome: true, condominioId: true },
    orderBy: { nome: "asc" },
  });
}

export async function listarUnidadesLeitura(
  condominioId: string,
  session: SessionUser,
) {
  return prisma.unidade.findMany({
    where: { condominioId, ...viaCondominio(session) },
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
