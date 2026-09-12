import { Prisma } from "@prisma/client";
import { GESTOR_PADRAO_ID } from "@/lib/multi-tenant";

export function ehCondominioVinculavel(gestorId: string | null) {
  return !gestorId || gestorId === GESTOR_PADRAO_ID;
}

export const filtroCondominiosVinculaveis: Prisma.CondominioWhereInput = {
  OR: [{ gestorId: null }, { gestorId: GESTOR_PADRAO_ID }],
};

export async function transferirCondominioParaGestor(
  tx: Prisma.TransactionClient,
  condominioId: string,
  novoGestorId: string,
) {
  const destino = await tx.gestor.findUnique({
    where: { id: novoGestorId },
    select: { id: true },
  });

  if (!destino) {
    throw new Error("GESTOR_NAO_ENCONTRADO");
  }

  const condominio = await tx.condominio.findFirst({
    where: {
      id: condominioId,
      ...filtroCondominiosVinculaveis,
    },
    select: { id: true, gestorId: true },
  });

  if (!condominio) {
    throw new Error("CONDOMINIO_INDISPONIVEL");
  }

  if (condominio.gestorId === novoGestorId) {
    throw new Error("MESMO_GESTOR");
  }

  await tx.condominio.update({
    where: { id: condominio.id },
    data: { gestorId: novoGestorId },
  });

  await tx.movimentoMensal.updateMany({
    where: { condominioId: condominio.id },
    data: { gestorId: novoGestorId },
  });
}

export function mensagemErroVinculo(error: unknown) {
  if (!(error instanceof Error)) {
    return "Não foi possível transferir o condomínio.";
  }

  if (error.message === "CONDOMINIO_INDISPONIVEL") {
    return "O condomínio selecionado não está disponível para vínculo. Escolha um condomínio órfão ou da Administradora Master.";
  }

  if (error.message === "GESTOR_NAO_ENCONTRADO") {
    return "Gestor de destino não encontrado.";
  }

  if (error.message === "MESMO_GESTOR") {
    return "Este condomínio já pertence ao gestor selecionado.";
  }

  return "Não foi possível transferir o condomínio.";
}
