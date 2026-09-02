import { garantirBlocoPadrao } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";

export const TIPOS_DESPESA_PADRAO = [
  "Água",
  "Água Condominio",
  "Gás",
  "Material Diversos",
  "Serviço Faxina",
  "Manutenções",
  "Energia Condominio",
  "Outras Despesas",
] as const;

export const FORMAS_COBRANCA_LABEL = {
  consumo: "Apuração pelo Consumo",
  divisao_igual: "Dividido Entre as Unidades",
} as const;

export type FormaCobranca = keyof typeof FORMAS_COBRANCA_LABEL;

export function ehAguaPorConsumo(tipoNome: string, formaCobranca: string) {
  return tipoNome === "Água" && formaCobranca === "consumo";
}

export function parseValorMonetario(valor: string) {
  const numero = Number(valor.trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : Number.NaN;
}

export function rotuloFormaCobranca(forma: string) {
  if (forma === "consumo" || forma === "divisao_igual") {
    return FORMAS_COBRANCA_LABEL[forma];
  }

  return forma;
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

export async function garantirTiposDespesa(condominioId: string) {
  const bloco = await garantirBlocoPadrao(condominioId);

  await Promise.all(
    TIPOS_DESPESA_PADRAO.map((nome) =>
      prisma.tipoDespesa.upsert({
        where: {
          nome_condominioId_blocoId: {
            nome,
            condominioId,
            blocoId: bloco.id,
          },
        },
        update: {},
        create: { nome, condominioId, blocoId: bloco.id },
      }),
    ),
  );
}
