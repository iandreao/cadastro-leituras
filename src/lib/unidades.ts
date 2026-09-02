export const TIPOS_UNIDADE_PADRAO = [
  "Apartamento",
  "Sala",
  "Loja",
  "Vaga de Garagem",
  "Condomínio",
] as const;

export const TIPOS_CONSUMO = [
  "Água/Gás",
  "Só Água",
  "Só Gás",
  "Nenhum",
] as const;

export type TipoConsumo = (typeof TIPOS_CONSUMO)[number];

export const includeTipoUnidade = {
  tipoUnidade: {
    select: {
      id: true,
      nome: true,
    },
  },
  bloco: {
    select: {
      id: true,
      nome: true,
    },
  },
} as const;

export function nomeTipoUnidade(
  tipo: string | { nome: string } | null | undefined,
) {
  if (!tipo) {
    return "";
  }

  return typeof tipo === "string" ? tipo : tipo.nome;
}

export function gerarNumerosUnidades(
  unidadeInicial: number,
  unidadesPorAndar: number,
  quantidadeAndares: number,
) {
  const numeros: string[] = [];

  for (let andar = 0; andar < quantidadeAndares; andar += 1) {
    for (let posicao = 0; posicao < unidadesPorAndar; posicao += 1) {
      numeros.push(String(unidadeInicial + andar * 100 + posicao));
    }
  }

  return numeros;
}
