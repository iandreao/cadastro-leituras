import { NOME_BLOCO_PADRAO, persistirBloco } from "@/lib/blocos";
import { prisma } from "@/lib/prisma";

export async function garantirBlocoPadrao(condominioId: string) {
  return prisma.bloco.upsert({
    where: {
      nome_condominioId: { nome: NOME_BLOCO_PADRAO, condominioId },
    },
    update: {},
    create: { nome: NOME_BLOCO_PADRAO, condominioId },
  });
}

export async function resolverBlocoDoCondominio(
  condominioId: string,
  blocoId: string | null | undefined,
) {
  const id = blocoId?.trim() ?? "";

  if (!id) {
    return { blocoId: "", error: "Selecione o bloco/torre." };
  }

  const bloco = await prisma.bloco.findUnique({ where: { id } });

  if (!bloco || bloco.condominioId !== condominioId) {
    return {
      blocoId: "",
      error: "O bloco/torre não pertence ao condomínio selecionado.",
    };
  }

  return { blocoId: bloco.id, error: null };
}

export async function nomeBlocoDuplicado(
  condominioId: string,
  nome: string,
  ignorarId?: string,
) {
  const chave = persistirBloco(nome);
  const blocos = await prisma.bloco.findMany({
    where: { condominioId },
    select: { id: true, nome: true },
  });

  return blocos.some(
    (item) =>
      item.id !== ignorarId &&
      (item.nome.trim().toLowerCase() === nome.trim().toLowerCase() ||
        persistirBloco(item.nome) === chave),
  );
}
