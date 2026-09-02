import { prisma } from "@/lib/prisma";

export const includeTipoDespesaConfig = {
  regras: {
    include: {
      tipoUnidade: {
        select: { id: true, nome: true },
      },
    },
    orderBy: { tipoUnidade: { nome: "asc" as const } },
  },
  _count: {
    select: { despesas: true },
  },
} as const;

export async function listarTiposDespesaPorBloco(
  condominioId: string,
  blocoId: string,
) {
  return prisma.tipoDespesa.findMany({
    where: { condominioId, blocoId },
    orderBy: { nome: "asc" },
    include: includeTipoDespesaConfig,
  });
}

export async function criarTipoDespesa(dados: {
  nome: string;
  condominioId: string;
  blocoId: string;
}) {
  return prisma.tipoDespesa.create({
    data: {
      nome: dados.nome,
      condominioId: dados.condominioId,
      blocoId: dados.blocoId,
    },
  });
}

export async function substituirRegrasParticipacao(
  tipoDespesaId: string,
  tipoUnidadeIds: string[],
  condominioId: string,
  blocoId: string,
) {
  const idsUnicos = [...new Set(tipoUnidadeIds)];

  if (idsUnicos.length > 0) {
    const tipos = await prisma.tipoUnidade.findMany({
      where: {
        id: { in: idsUnicos },
        condominioId,
        blocoId,
      },
      select: { id: true },
    });

    if (tipos.length !== idsUnicos.length) {
      return { error: "Há tipo de unidade inválido na participação." };
    }
  }

  await prisma.regraParticipacao.deleteMany({ where: { tipoDespesaId } });

  if (idsUnicos.length > 0) {
    await prisma.regraParticipacao.createMany({
      data: idsUnicos.map((tipoUnidadeId) => ({
        tipoUnidadeId,
        tipoDespesaId,
      })),
    });
  }

  return { error: null };
}
