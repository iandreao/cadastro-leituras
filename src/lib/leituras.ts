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

export const CASAS_DECIMAIS_LEITURA = 3;
export const LIMITE_CONSUMO_GAS_M3 = 500;
const MAX_DIGITOS_INTEIROS_LEITURA = 8;

export function mascararLeitura(value: string) {
  let inteiro = "";
  let decimal = "";
  let separador = "";

  for (const char of value) {
    if (char >= "0" && char <= "9") {
      if (!separador) {
        if (inteiro.length < MAX_DIGITOS_INTEIROS_LEITURA) {
          inteiro += char;
        }
      } else if (decimal.length < CASAS_DECIMAIS_LEITURA) {
        decimal += char;
      }
      continue;
    }

    if ((char === "," || char === ".") && !separador) {
      separador = char;
    }
  }

  if (!inteiro && !separador) {
    return "";
  }

  const parteInteira = inteiro.replace(/^0+(?=\d)/, "") || "0";

  if (!separador) {
    return parteInteira;
  }

  return `${parteInteira}${separador}${decimal}`;
}

export function parseLeitura(value: string) {
  const mascarado = mascararLeitura(value.trim());

  if (!mascarado) {
    return Number.NaN;
  }

  const numero = Number(mascarado.replace(",", "."));

  if (!Number.isFinite(numero) || numero < 0) {
    return Number.NaN;
  }

  return Number(numero.toFixed(CASAS_DECIMAIS_LEITURA));
}

export function parseLeituraDigitada(value: string, anterior = 0) {
  const bruto = value.trim();
  const numero = parseLeitura(bruto);

  if (Number.isNaN(numero)) {
    return Number.NaN;
  }

  if (/[.,]/.test(bruto) || anterior <= 0) {
    return numero;
  }

  const candidatos = [numero, numero / 10, numero / 100, numero / 1000]
    .map((item) => Number(item.toFixed(CASAS_DECIMAIS_LEITURA)))
    .filter((item) => item >= anterior)
    .sort((a, b) => Math.abs(a - anterior) - Math.abs(b - anterior));

  return candidatos[0] ?? numero;
}

export function formatarLeitura(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") {
    return "";
  }

  const numero =
    typeof valor === "number" ? valor : parseLeitura(String(valor));

  if (!Number.isFinite(numero) || numero < 0) {
    return "";
  }

  return Number(numero.toFixed(CASAS_DECIMAIS_LEITURA))
    .toFixed(CASAS_DECIMAIS_LEITURA)
    .replace(".", ",");
}

export function consumoM3(leituraAtual: number, leituraAnterior: number) {
  return Number((leituraAtual - leituraAnterior).toFixed(CASAS_DECIMAIS_LEITURA));
}

export function consumoGasInconsistente(consumo: number) {
  return Number.isFinite(consumo) && consumo > LIMITE_CONSUMO_GAS_M3;
}

export function formatarConsumoM3(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: CASAS_DECIMAIS_LEITURA,
  }).format(valor);
}

export function mensagemConsumoGasInconsistente(
  unidade: string,
  consumo: number,
) {
  return `A unidade ${unidade} apresentou um consumo inconsistente de ${formatarConsumoM3(consumo)} m³. Por favor, verifique as leituras digitadas.`;
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
  tipoUnidade: string | { nome: string };
  numero: string;
  bloco?: string | { nome: string } | null;
}) {
  const bloco =
    typeof unidade.bloco === "string"
      ? unidade.bloco.trim()
      : unidade.bloco?.nome.trim();
  const tipo =
    typeof unidade.tipoUnidade === "string"
      ? unidade.tipoUnidade
      : unidade.tipoUnidade.nome;
  return `${tipo} ${unidade.numero}${bloco ? ` • ${bloco}` : ""}`;
}
