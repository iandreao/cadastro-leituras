import { prisma } from "@/lib/prisma";
import { buscarMoradoresNaCompetencia } from "@/lib/historico-morador";
import {
  consumoGasInconsistente,
  consumoM3,
  mensagemConsumoGasInconsistente,
  rotuloUnidade,
} from "@/lib/leituras";
import { movimentoEstaFechado } from "@/lib/movimento";

export const TIPO_UNIDADE_CONDOMINIO = "Condomínio";
export const TIPO_AGUA_FIXO = "Água Condominio";
export const TIPO_AGUA_VARIAVEL = "Água";
export const TIPO_GAS = "Gás";
export const TIPO_TAXA_MENSAL = "Taxa Mensal";
export const DIVISOR_VALOR_M3_GAS = 20;

export type ClassificacaoDespesaApuracao = "fixa" | "agua" | "gas";

export type DespesaPeriodoApuracao = {
  nome: string;
  bloco: string;
  formaCobranca: string;
  classificacao: ClassificacaoDespesaApuracao;
  valorTotal: number;
};

export type ResumoApuracao = {
  totalFixo: number;
  totalAgua: number;
  totalGas: number;
  unidades: number;
  valorM3Agua: number | null;
  valorM3Gas: number | null;
  consumoAguaM3: number;
  consumoGasM3: number;
};

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
  bloco: { id: string; nome: string };
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
  tiposComRegra: Set<string>,
) {
  return unidades.filter((unidade) => {
    if (ehUnidadeCondominio(unidade)) {
      return false;
    }

    if (!unidadeNoEscopo(unidade, blocoDespesaId)) {
      return false;
    }

    if (!tiposComRegra.has(tipoDespesaId)) {
      return true;
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

function classificacaoResumo(
  tipo: ReturnType<typeof classificarDespesa>,
): ClassificacaoDespesaApuracao {
  if (tipo === "gas") {
    return "gas";
  }

  if (tipo === "agua_variavel" || tipo === "agua_fixo") {
    return "agua";
  }

  return "fixa";
}

async function carregarConsumosPorUnidade(
  unidadeIds: string[],
  mes: number,
  ano: number,
) {
  const agua = new Map<string, number>();
  const gas = new Map<string, number>();

  if (unidadeIds.length === 0) {
    return { agua, gas };
  }

  const anterior = periodoAnterior(mes, ano);
  const leituras = await prisma.leitura.findMany({
    where: {
      unidadeId: { in: unidadeIds },
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

  const atualPorUnidade = new Map(
    leituras
      .filter((item) => item.mes === mes && item.ano === ano)
      .map((item) => [item.unidadeId, item]),
  );
  const previaPorUnidade = new Map(
    leituras
      .filter((item) => item.mes === anterior.mes && item.ano === anterior.ano)
      .map((item) => [item.unidadeId, item]),
  );

  for (const unidadeId of unidadeIds) {
    const atual = atualPorUnidade.get(unidadeId);
    const previa = previaPorUnidade.get(unidadeId);
    agua.set(unidadeId, consumoLeitura(atual?.valorAgua, previa?.valorAgua));
    gas.set(
      unidadeId,
      consumoM3(Number(atual?.valorGas ?? 0), Number(previa?.valorGas ?? 0)),
    );
  }

  return { agua, gas };
}

export async function listarDespesasPeriodo(
  condominioId: string,
  mes: number,
  ano: number,
): Promise<DespesaPeriodoApuracao[]> {
  const despesas =
    (await prisma.despesaMensal.findMany({
      where: { condominioId, mes, ano },
      include: {
        tipoDespesa: {
          select: { nome: true },
        },
        bloco: {
          select: { nome: true },
        },
      },
      orderBy: [{ bloco: { nome: "asc" } }, { tipoDespesa: { nome: "asc" } }],
    })) ?? [];

  return despesas.map((despesa) => {
    const nomeTipo = despesa.tipoDespesa?.nome ?? "";
    const tipo = classificarDespesa(nomeTipo);

    return {
      nome: nomeTipo,
      bloco: despesa.bloco?.nome ?? "",
      formaCobranca: despesa.formaCobranca ?? "",
      classificacao: classificacaoResumo(tipo),
      valorTotal: Number(despesa.valorTotal ?? 0),
    };
  });
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
  tiposComRegra: Set<string>,
) {
  const participantes = unidadesParticipantes(
    unidades,
    blocoDespesa,
    tipoDespesaId,
    regras,
    tiposComRegra,
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
  const faturas = await prisma.faturaUnidade.findMany({
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
          celular: true,
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

  const consumos = await carregarConsumosPorUnidade(
    faturas.map((fatura) => fatura.unidadeId),
    mes,
    ano,
  );
  const moradores = await buscarMoradoresNaCompetencia(
    faturas.map((fatura) => fatura.unidadeId),
    mes,
    ano,
  );

  return faturas.map((fatura) => {
    const morador = moradores.get(fatura.unidadeId);

    return {
      ...fatura,
      unidade: {
        ...fatura.unidade,
        nomeMorador: morador ? morador.nomeMorador : fatura.unidade.nomeMorador,
        celular: morador ? morador.celular : fatura.unidade.celular,
      },
      consumoAguaM3: consumos.agua.get(fatura.unidadeId) ?? 0,
      consumoGasM3: consumos.gas.get(fatura.unidadeId) ?? 0,
    };
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
      bloco: {
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

  if (despesas.length === 0) {
    return {
      error: "Não há despesas cadastradas para este condomínio no mês selecionado.",
      status: 400 as const,
    };
  }

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
  const tiposComRegra = new Set(
    registrosRegras.map((regra) => regra.tipoDespesaId),
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
  let valorM3Agua: number | null = null;
  let valorM3Gas: number | null = null;
  let consumoAguaResumo = 0;
  let consumoGasResumo = 0;

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
    const tipo = classificarDespesa(despesa.tipoDespesa?.nome ?? "");
    const valor = Number(despesa.valorTotal);
    const participantes = unidadesParticipantes(
      unidades,
      despesa.blocoId,
      tipoDespesaId,
      regras,
      tiposComRegra,
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
        tiposComRegra,
      );

      const comuns = unidades.filter(
        (unidade) =>
          unidadeNoEscopo(unidade, despesa.blocoId) &&
          ehUnidadeCondominio(unidade),
      );
      const somaConsumo = [...participantes, ...comuns].reduce(
        (total, unidade) => total + (consumoAgua.get(unidade.id) ?? 0),
        0,
      );
      consumoAguaResumo += somaConsumo;
      valorM3Agua =
        somaConsumo > 0 && valorVariavel > 0 ? valorVariavel / somaConsumo : valorM3Agua;
      continue;
    }

    if (tipo === "taxa_mensal") {
      ratearIgual(valores, participantes, "valorEnergia", valor);
      continue;
    }

    if (tipo === "gas") {
      const despesaGas = Number(despesa.valorTotal);

      for (const unidade of participantes) {
        const leituraAtual = Number(leiturasMes.get(unidade.id)?.valorGas ?? 0);
        const leituraAnterior = Number(
          leiturasMesAnterior.get(unidade.id)?.valorGas ?? 0,
        );
        const consumo = consumoM3(leituraAtual, leituraAnterior);

        if (consumoGasInconsistente(consumo)) {
          return {
            error: mensagemConsumoGasInconsistente(
              rotuloUnidade(unidade),
              consumo,
            ),
            status: 400 as const,
          };
        }
      }

      for (const unidade of participantes) {
        const atual = valores.get(unidade.id);

        if (!atual) {
          continue;
        }

        const leituraAtual = Number(leiturasMes.get(unidade.id)?.valorGas ?? 0);
        const leituraAnterior = Number(
          leiturasMesAnterior.get(unidade.id)?.valorGas ?? 0,
        );
        const consumo = consumoM3(leituraAtual, leituraAnterior);
        const valorM3 = despesaGas / DIVISOR_VALOR_M3_GAS;
        valorM3Gas = valorM3;
        consumoGasResumo += consumo;
        atual.valorGas += consumo * valorM3;
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
  const despesasPeriodo = await listarDespesasPeriodo(condominioId, mes, ano);
  const resumo: ResumoApuracao = montarResumoDeFaturas(
    faturas,
    valorM3Agua,
    valorM3Gas,
    consumoAguaResumo,
    consumoGasResumo,
  );

  return { faturas, resumo, despesasPeriodo };
}

export function montarResumoDeFaturas(
  faturas: Awaited<ReturnType<typeof listarFaturasApuracao>>,
  valorM3Agua: number | null = null,
  valorM3Gas: number | null = null,
  consumoAguaM3?: number,
  consumoGasM3?: number,
): ResumoApuracao {
  return {
    totalFixo: arredondarMoeda(
      faturas.reduce(
        (total, fatura) =>
          total + Number(fatura.valorEnergia) + Number(fatura.valorOutras),
        0,
      ),
    ),
    totalAgua: arredondarMoeda(
      faturas.reduce((total, fatura) => total + Number(fatura.valorAgua), 0),
    ),
    totalGas: arredondarMoeda(
      faturas.reduce((total, fatura) => total + Number(fatura.valorGas), 0),
    ),
    unidades: faturas.length,
    valorM3Agua,
    valorM3Gas,
    consumoAguaM3:
      consumoAguaM3 ??
      Number(
        faturas
          .reduce((total, fatura) => total + Number(fatura.consumoAguaM3 ?? 0), 0)
          .toFixed(3),
      ),
    consumoGasM3:
      consumoGasM3 ??
      Number(
        faturas
          .reduce((total, fatura) => total + Number(fatura.consumoGasM3 ?? 0), 0)
          .toFixed(3),
      ),
  };
}

export async function carregarApuracaoPeriodo(
  condominioId: string,
  mes: number,
  ano: number,
) {
  const fechado = await movimentoEstaFechado(condominioId, mes, ano);
  const despesasPeriodo =
    (await listarDespesasPeriodo(condominioId, mes, ano)) ?? [];

  if (fechado) {
    const faturas = (await listarFaturasApuracao(condominioId, mes, ano)) ?? [];

    return {
      movimento: { fechado: true as const },
      faturas,
      despesasPeriodo,
      resumo: faturas.length > 0 ? montarResumoDeFaturas(faturas) : null,
    };
  }

  const resultado = await processarApuracao(condominioId, mes, ano);

  if ("error" in resultado) {
    return {
      movimento: { fechado: false as const },
      faturas: [] as Awaited<ReturnType<typeof listarFaturasApuracao>>,
      despesasPeriodo,
      resumo: null,
      error: resultado.error,
      status: resultado.status,
    };
  }

  return {
    movimento: { fechado: false as const },
    faturas: resultado.faturas,
    resumo: resultado.resumo,
    despesasPeriodo: resultado.despesasPeriodo,
  };
}
