export const TIPOS_UNIDADE_PADRAO = [
  "Apartamento",
  "Sala",
  "Loja",
  "Vaga de Garagem",
  "Condomínio",
] as const;

export const TIPOS_UNIDADE = TIPOS_UNIDADE_PADRAO;
export type TipoUnidade = (typeof TIPOS_UNIDADE_PADRAO)[number];

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

export type ContagemExclusaoUnidade = {
  leituras?: number;
  faturas?: number;
  leiturasAgua?: number;
  leiturasGas?: number;
};

export function exclusaoUnidadeBloqueada(item: {
  exclusaoBloqueada?: boolean;
  _count?: ContagemExclusaoUnidade | null;
}) {
  if (typeof item.exclusaoBloqueada === "boolean") {
    return item.exclusaoBloqueada;
  }

  const contagem = item._count;
  return (
    (contagem?.leituras ?? 0) > 0 ||
    (contagem?.faturas ?? 0) > 0 ||
    (contagem?.leiturasAgua ?? 0) > 0 ||
    (contagem?.leiturasGas ?? 0) > 0
  );
}
