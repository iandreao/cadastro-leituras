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

export async function garantirTiposDespesa() {
  const energia = await prisma.tipoDespesa.findUnique({
    where: { nome: "Energia" },
  });
  const aguaCondominio = await prisma.tipoDespesa.findUnique({
    where: { nome: "Água Condominio" },
  });

  if (energia && !aguaCondominio) {
    await prisma.tipoDespesa.update({
      where: { id: energia.id },
      data: { nome: "Água Condominio" },
    });
  } else if (energia && aguaCondominio) {
    await prisma.despesaMensal.updateMany({
      where: { tipoDespesaId: energia.id },
      data: { tipoDespesaId: aguaCondominio.id },
    });
    await prisma.tipoDespesa.delete({ where: { id: energia.id } });
  }

  await Promise.all(
    TIPOS_DESPESA_PADRAO.map((nome) =>
      prisma.tipoDespesa.upsert({
        where: { nome },
        update: {},
        create: { nome },
      }),
    ),
  );
}
