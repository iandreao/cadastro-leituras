export const TIPOS_UNIDADE = [
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

export type TipoUnidade = (typeof TIPOS_UNIDADE)[number];
export type TipoConsumo = (typeof TIPOS_CONSUMO)[number];

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
