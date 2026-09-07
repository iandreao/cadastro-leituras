import { NOME_BLOCO_PADRAO, persistirBloco } from "@/lib/blocos";
import { prisma } from "@/lib/prisma";

type BlocoNome = {
  id: string;
  nome: string;
};

export const includeBlocoCadastro = {
  _count: {
    select: {
      unidades: true,
      tiposUnidade: true,
      tiposDespesa: true,
      despesasMensais: true,
    },
  },
} as const;

export async function listarBlocosPorCondominio(condominioId: string) {
  const id = String(condominioId).trim();
  const blocos = await prisma.bloco.findMany({
    where: { condominioId: id },
    orderBy: { nome: "asc" },
    include: includeBlocoCadastro,
  });

  return blocos
    .filter((bloco) => Boolean(bloco?.id))
    .map((bloco) => ({
      ...bloco,
      id: String(bloco.id),
      condominioId: String(bloco.condominioId ?? ""),
    }));
}

export async function criarBloco(condominioId: string, nome: string) {
  const id = String(condominioId).trim();

  return prisma.bloco.create({
    data: {
      nome,
      condominio: {
        connect: { id },
      },
    },
    include: includeBlocoCadastro,
  });
}

export async function garantirBlocoPadrao(condominioId: string) {
  return prisma.bloco.upsert({
    where: {
      nome_condominioId: {
        nome: NOME_BLOCO_PADRAO,
        condominioId,
      },
    },
    update: {},
    create: {
      nome: NOME_BLOCO_PADRAO,
      condominioId,
    },
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

  const bloco = await prisma.bloco.findUnique({
    where: { id },
    select: { id: true, condominioId: true },
  });

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
  const blocos: BlocoNome[] = await prisma.bloco.findMany({
    where: { condominioId },
    select: { id: true, nome: true },
  });

  return blocos.some((item: BlocoNome) => {
    if (item.id === ignorarId) {
      return false;
    }

    return (
      item.nome.trim().toLowerCase() === nome.trim().toLowerCase() ||
      persistirBloco(item.nome) === chave
    );
  });
}
