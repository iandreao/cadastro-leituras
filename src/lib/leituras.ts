export const MESES = [
  { valor: 1, nome: "Janeiro" },
  { valor: 2, nome: "Fevereiro" },
  { valor: 3, nome: "Março" },
  { valor: 4, nome: "Abril" },
  { valor: 5, nome: "Maio" },
  { valor: 6, nome: "Junho" },
  { valor: 7, nome: "Julho" },
  { valor: 8, nome: "Agosto" },
  { valor: 9, nome: "Setembro" },
  { valor: 10, nome: "Outubro" },
  { valor: 11, nome: "Novembro" },
  { valor: 12, nome: "Dezembro" },
] as const;

export function anosReferencia(atual = new Date().getFullYear()) {
  const anos: number[] = [];

  for (let ano = atual - 3; ano <= atual + 1; ano += 1) {
    anos.push(ano);
  }

  return anos;
}

export function indiceReferencia(ano: number, mes: number) {
  return ano * 12 + (mes - 1);
}

export function nomeMes(mes: number) {
  return MESES.find((item) => item.valor === mes)?.nome ?? String(mes);
}

export function parseLeitura(value: string) {
  const numero = Number(value.trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : Number.NaN;
}

export function usaAgua(tipoConsumo: string) {
  return tipoConsumo === "Água/Gás" || tipoConsumo === "Só Água";
}

export function usaGas(tipoConsumo: string) {
  return tipoConsumo === "Água/Gás" || tipoConsumo === "Só Gás";
}

export function unidadeElegivelPara(
  tipoConsumo: string,
  tipo: "agua" | "gas",
) {
  return tipo === "agua" ? usaAgua(tipoConsumo) : usaGas(tipoConsumo);
}

export function periodoMenor(
  ano: number,
  mes: number,
  anoRef: number,
  mesRef: number,
) {
  return ano < anoRef || (ano === anoRef && mes < mesRef);
}

export function rotuloUnidade(unidade: {
  tipoUnidade: string;
  numero: string;
  bloco?: string | null;
}) {
  const bloco = unidade.bloco?.trim();
  return `${unidade.tipoUnidade} ${unidade.numero}${bloco ? ` • ${bloco}` : ""}`;
}
