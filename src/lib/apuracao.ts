import { prisma } from "@/lib/prisma";

export const TIPO_UNIDADE_CONDOMINIO = "Condomínio";
export const TIPO_AGUA_FIXO = "Água Condominio";
export const TIPO_AGUA_VARIAVEL = "Água";
export const TIPO_GAS = "Gás";
export const TIPO_TAXA_MENSAL = "Taxa Mensal";

type TipoUnidadeRelacao = {
  id: string;
  nome: string;
};

type TipoDespesaRelacao = {
  id: string;
  nome: string;
};

type UnidadeApuracao = {
  id: string;
  numero: string;
  blocoId: string;
  tipoUnidadeId: string;
  tipoUnidade: TipoUnidadeRelacao;
};

type DespesaApuracao = {
  blocoId: string;
  valorTotal: number;
  valorFixo: number | null;
  valorVariavel: number | null;
  formaCobranca: string;
  tipoDespesaId: string;
  tipoDespesa: TipoDespesaRelacao;
};

type RegraParticipacao = {
  tipoUnidadeId: string;
  tipoDespesaId: string;
};

type ValoresUnidade = {
  valorAgua: number;
  valorEnergia: number;
  valorGas: number;
  valorOutras: number;
};

type CampoRateio = keyof ValoresUnidade;

export function periodoAnterior(mes: number, ano: number) {
  if (mes === 1) {
    return { mes: 12, ano: ano - 1 };
  }

  return { mes: mes - 1, ano };
}

export function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function ehUnidadeCondominio(unidade: UnidadeApuracao) {
  return unidade.tipoUnidade.nome === TIPO_UNIDADE_CONDOMINIO;
}

function unidadeNoEscopo(unidade: UnidadeApuracao, blocoDespesaId: string) {
  return unidade.blocoId === blocoDespesaId;
}

function chaveParticipacao(tipoUnidadeId: string, tipoDespesaId: string) {
  return `${tipoUnidadeId}::${tipoDespesaId}`;
}

function participaDoRateio(
  tipoUnidadeId: string,
  tipoDespesaId: string,
  regras: Set<string>,
) {
  return regras.has(chaveParticipacao(tipoUnidadeId, tipoDespesaId));
}

function unidadesParticipantes(
  unidades: UnidadeApuracao[],
  blocoDespesaId: string,
  tipoDespesaId: string,
  regras: Set<string>,
) {
  return unidades.filter((unidade) => {
    if (ehUnidadeCondominio(unidade)) {
      return false;
    }

    if (!unidadeNoEscopo(unidade, blocoDespesaId)) {
      return false;
    }

    return participaDoRateio(unidade.tipoUnidadeId, tipoDespesaId, regras);
  });
}

function consumoLeitura(
  atual: number | null | undefined,
  anterior: number | null | undefined,
) {
  return Math.max(0, Number(atual ?? 0) - Number(anterior ?? 0));
}

function normalizarNomeTipo(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function ehTaxaMensal(nome: string) {
  const normalizado = normalizarNomeTipo(nome);
  return (
    normalizado === normalizarNomeTipo(TIPO_TAXA_MENSAL) ||
    normalizado === "txa mensal"
  );
}

function classificarDespesa(nome: string) {
  if (nome === TIPO_AGUA_VARIAVEL) {
    return "agua_variavel" as const;
  }

  if (nome === TIPO_AGUA_FIXO) {
    return "agua_fixo" as const;
  }

  if (nome === TIPO_GAS) {
    return "gas" as const;
  }

  if (ehTaxaMensal(nome)) {
    return "taxa_mensal" as const;
  }

  return "outras" as const;
}

function valoresZerados(): ValoresUnidade {
  return {
    valorAgua: 0,
    valorEnergia: 0,
    valorGas: 0,
    valorOutras: 0,
  };
}

function ratearIgual(
  valores: Map<string, ValoresUnidade>,
  participantes: UnidadeApuracao[],
  campo: CampoRateio,
  valorTotal: number,
) {
  if (participantes.length === 0 || valorTotal <= 0) {
    return;
  }

  const parcela = valorTotal / participantes.length;

  for (const unidade of participantes) {
    const atual = valores.get(unidade.id);

    if (atual) {
      atual[campo] += parcela;
    }
  }
}

function aplicarAguaPorConsumo(
  valores: Map<string, ValoresUnidade>,
  unidades: UnidadeApuracao[],
  blocoDespesa: string,
  consumoAgua: Map<string, number>,
  valorFixo: number,
  valorVariavel: number,
  regras: Set<string>,
  tipoDespesaId: string,
) {
  const participantes = unidadesParticipantes(
    unidades,
    blocoDespesa,
    tipoDespesaId,
    regras,
  );
  const comuns = unidades.filter(
    (unidade) =>
      unidadeNoEscopo(unidade, blocoDespesa) && ehUnidadeCondominio(unidade),
  );

  if (participantes.length === 0) {
    return;
  }

  const somaConsumo = [...participantes, ...comuns].reduce(
    (total, unidade) => total + (consumoAgua.get(unidade.id) ?? 0),
    0,
  );
  const fuc =
    somaConsumo > 0 && valorVariavel > 0 ? valorVariavel / somaConsumo : 0;
  const consumoCondominio = comuns.reduce(
    (total, unidade) => total + (consumoAgua.get(unidade.id) ?? 0),
    0,
  );
  const parcelaFixa = valorFixo > 0 ? valorFixo / participantes.length : 0;
  const parcelaCondominio =
    fuc > 0 ? (consumoCondominio * fuc) / participantes.length : 0;

  for (const unidade of participantes) {
    const atual = valores.get(unidade.id);

    if (!atual) {
      continue;
    }

    const consumoIndividual = consumoAgua.get(unidade.id) ?? 0;
    atual.valorAgua +=
      parcelaFixa + consumoIndividual * fuc + parcelaCondominio;
  }
}

export async function listarFaturasApuracao(
  condominioId: string,
  mes: number,
  ano: number,
) {
  return prisma.faturaUnidade.findMany({
    where: {
      mes,
      ano,
      unidade: {
        condominioId,
        tipoUnidade: {
          nome: { not: TIPO_UNIDADE_CONDOMINIO },
        },
      },
    },
    orderBy: [{ unidade: { bloco: { nome: "asc" } } }, { unidade: { numero: "asc" } }],
    include: {
      unidade: {
        select: {
          id: true,
          numero: true,
          blocoId: true,
          nomeMorador: true,
          bloco: {
            select: { id: true, nome: true },
          },
          tipoUnidade: {
            select: {
              nome: true,
            },
          },
        },
      },
    },
  });
}

export async function processarApuracao(
  condominioId: string,
  mes: number,
  ano: number,
) {
  const condominio = await prisma.condominio.findUnique({
    where: { id: condominioId },
  });

  if (!condominio) {
    return { error: "Condomínio não encontrado.", status: 404 as const };
  }

  const unidades = await prisma.unidade.findMany({
    where: { condominioId },
    orderBy: [{ bloco: { nome: "asc" } }, { numero: "asc" }],
    select: {
      id: true,
      numero: true,
      blocoId: true,
      tipoUnidadeId: true,
      tipoUnidade: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });

  if (unidades.length === 0) {
    return {
      error: "Não há unidades cadastradas neste condomínio.",
      status: 400 as const,
    };
  }

  const anterior = periodoAnterior(mes, ano);

  const despesas = await prisma.despesaMensal.findMany({
    where: { condominioId, mes, ano },
    include: {
      tipoDespesa: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });

  const registrosRegras = await prisma.regraParticipacao.findMany({
    where: {
      tipoUnidade: { condominioId },
      tipoDespesa: { condominioId },
    },
    select: {
      tipoUnidadeId: true,
      tipoDespesaId: true,
    },
  });
  const regras: Set<string> = new Set(
    registrosRegras.map((regra) =>
      chaveParticipacao(regra.tipoUnidadeId, regra.tipoDespesaId),
    ),
  );

  const leituras = await prisma.leitura.findMany({
    where: {
      unidadeId: { in: unidades.map((unidade) => unidade.id) },
      OR: [
        { mes, ano },
        { mes: anterior.mes, ano: anterior.ano },
      ],
    },
    select: {
      unidadeId: true,
      mes: true,
      ano: true,
      valorAgua: true,
      valorGas: true,
    },
  });

  const leiturasMes = new Map(
    leituras
      .filter((item) => item.mes === mes && item.ano === ano)
      .map((item) => [item.unidadeId, item]),
  );
  const leiturasMesAnterior = new Map(
    leituras
      .filter((item) => item.mes === anterior.mes && item.ano === anterior.ano)
      .map((item) => [item.unidadeId, item]),
  );

  const consumoAgua = new Map<string, number>();
  const valores = new Map<string, ValoresUnidade>();

  for (const unidade of unidades) {
    const atual = leiturasMes.get(unidade.id);
    const previa = leiturasMesAnterior.get(unidade.id);

    consumoAgua.set(
      unidade.id,
      consumoLeitura(atual?.valorAgua, previa?.valorAgua),
    );
    valores.set(unidade.id, valoresZerados());
  }

  for (const despesa of despesas) {
    const tipoDespesaId = despesa.tipoDespesaId;
    const tipo = classificarDespesa(despesa.tipoDespesa.nome);
    const valor = Number(despesa.valorTotal);
    const participantes = unidadesParticipantes(
      unidades,
      despesa.blocoId,
      tipoDespesaId,
      regras,
    );

    if (tipo === "agua_fixo") {
      ratearIgual(valores, participantes, "valorAgua", valor);
      continue;
    }

    if (tipo === "agua_variavel") {
      if (despesa.formaCobranca !== "consumo") {
        ratearIgual(valores, participantes, "valorAgua", valor);
        continue;
      }

      const valorFixo = Number(despesa.valorFixo ?? 0);
      const valorVariavel = Number(
        despesa.valorVariavel ?? (despesa.valorFixo == null ? valor : 0),
      );

      aplicarAguaPorConsumo(
        valores,
        unidades,
        despesa.blocoId,
        consumoAgua,
        valorFixo,
        valorVariavel,
        regras,
        tipoDespesaId,
      );
      continue;
    }

    if (tipo === "taxa_mensal") {
      ratearIgual(valores, participantes, "valorEnergia", valor);
      continue;
    }

    if (tipo === "gas") {
      const despesaGas = Number(despesa.valorTotal);

      for (const unidade of participantes) {
        const atual = valores.get(unidade.id);

        if (!atual) {
          continue;
        }

        const leituraAtual = Number(leiturasMes.get(unidade.id)?.valorGas ?? 0);
        const leituraAnterior = Number(
          leiturasMesAnterior.get(unidade.id)?.valorGas ?? 0,
        );
        const consumoM3 = leituraAtual - leituraAnterior;
        const valorM3 = despesaGas / 20;
        atual.valorGas = consumoM3 * valorM3;
      }

      continue;
    }

    ratearIgual(valores, participantes, "valorOutras", valor);
  }

  const unidadesPrivativas = unidades.filter(
    (unidade) => !ehUnidadeCondominio(unidade),
  );

  await prisma.$transaction([
    prisma.faturaUnidade.deleteMany({
      where: {
        mes,
        ano,
        unidade: {
          condominioId,
          tipoUnidade: {
            nome: TIPO_UNIDADE_CONDOMINIO,
          },
        },
      },
    }),
    ...unidadesPrivativas.map((unidade) => {
      const atual = valores.get(unidade.id) ?? valoresZerados();
      const valorAgua = arredondarMoeda(atual.valorAgua);
      const valorEnergia = arredondarMoeda(atual.valorEnergia);
      const valorGas = Number(atual.valorGas);
      const valorOutras = arredondarMoeda(atual.valorOutras);
      const valorTotal = arredondarMoeda(
        valorAgua + valorEnergia + valorGas + valorOutras,
      );

      return prisma.faturaUnidade.upsert({
        where: {
          unidadeId_mes_ano: {
            unidadeId: unidade.id,
            mes,
            ano,
          },
        },
        update: {
          valorAgua,
          valorEnergia,
          valorGas,
          valorOutras,
          valorTotal,
        },
        create: {
          unidadeId: unidade.id,
          mes,
          ano,
          valorAgua,
          valorEnergia,
          valorGas,
          valorOutras,
          valorTotal,
        },
      });
    }),
  ]);

  const faturas = await listarFaturasApuracao(condominioId, mes, ano);

  return { faturas, despesas: despesas.length };
}
