import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { escolherMoradorNaCompetencia } from "@/lib/historico-morador";
import { limitesCompetencia } from "@/lib/periodo";
import { movimentoEstaFechado } from "@/lib/movimento";
import { escopoTenant } from "@/lib/multi-tenant";
import {
  consumoGasInconsistente,
  consumoM3,
  mensagemConsumoGasInconsistente,
  rotuloUnidade,
} from "@/lib/leituras";

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

type LeituraPeriodo = {
  mes: number;
  ano: number;
  valorAgua: number | null;
  valorGas: number | null;
};

type HistoricoMoradorApuracao = {
  nomeMorador: string;
  celular: string;
  email?: string;
  dataEntrada: Date;
  dataSaida: Date | null;
};

type UnidadeApuracao = {
  id: string;
  numero: string;
  blocoId: string;
  tipoUnidadeId: string;
  nomeMorador?: string;
  celular?: string;
  tipoUnidade: TipoUnidadeRelacao;
  bloco: { id: string; nome: string };
  leituras?: LeituraPeriodo[];
  historicoMoradores?: HistoricoMoradorApuracao[];
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

function filtroLeiturasCompetencia(mes: number, ano: number) {
  const anterior = periodoAnterior(mes, ano);
  return {
    OR: [
      { mes, ano },
      { mes: anterior.mes, ano: anterior.ano },
    ],
  };
}

function indexarLeiturasPorPeriodo(
  leituras: Array<LeituraPeriodo & { unidadeId: string }>,
  mes: number,
  ano: number,
) {
  const anterior = periodoAnterior(mes, ano);
  const atual = new Map<string, LeituraPeriodo>();
  const previa = new Map<string, LeituraPeriodo>();

  for (const item of leituras) {
    if (item.mes === mes && item.ano === ano) {
      atual.set(item.unidadeId, item);
    } else if (item.mes === anterior.mes && item.ano === anterior.ano) {
      previa.set(item.unidadeId, item);
    }
  }

  return { atual, previa };
}

async function carregarPacoteApuracao(
  condominioId: string,
  mes: number,
  ano: number,
  session?: SessionUser | null,
) {
  const { fim } = limitesCompetencia(mes, ano);

  return prisma.condominio.findFirst({
    where: { id: condominioId, ...escopoTenant(session) },
    relationLoadStrategy: "join",
    select: {
      id: true,
      despesasMensais: {
        where: { mes, ano },
        orderBy: [{ bloco: { nome: "asc" } }, { tipoDespesa: { nome: "asc" } }],
        select: {
          blocoId: true,
          valorTotal: true,
          valorFixo: true,
          valorVariavel: true,
          formaCobranca: true,
          tipoDespesaId: true,
          tipoDespesa: {
            select: { id: true, nome: true },
          },
          bloco: {
            select: { nome: true },
          },
        },
      },
      tiposDespesa: {
        select: {
          regras: {
            select: {
              tipoUnidadeId: true,
              tipoDespesaId: true,
            },
          },
        },
      },
      unidades: {
        orderBy: [{ bloco: { nome: "asc" } }, { numero: "asc" }],
        select: {
          id: true,
          numero: true,
          blocoId: true,
          tipoUnidadeId: true,
          nomeMorador: true,
          celular: true,
          tipoUnidade: {
            select: { id: true, nome: true },
          },
          bloco: {
            select: { id: true, nome: true },
          },
          leituras: {
            where: filtroLeiturasCompetencia(mes, ano),
            select: {
              mes: true,
              ano: true,
              valorAgua: true,
              valorGas: true,
            },
          },
          historicoMoradores: {
            where: { dataEntrada: { lte: fim } },
            orderBy: { dataEntrada: "asc" },
            select: {
              nomeMorador: true,
              celular: true,
              email: true,
              dataEntrada: true,
              dataSaida: true,
            },
          },
          faturas: {
            where: { mes, ano },
            take: 1,
            select: {
              id: true,
              unidadeId: true,
              mes: true,
              ano: true,
              valorAgua: true,
              valorEnergia: true,
              valorGas: true,
              valorOutras: true,
              valorTotal: true,
            },
          },
        },
      },
    },
  });
}

type PacoteApuracao = NonNullable<Awaited<ReturnType<typeof carregarPacoteApuracao>>>;

function mapearDespesasPeriodo(
  despesas: PacoteApuracao["despesasMensais"],
): DespesaPeriodoApuracao[] {
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

function montarFaturasSalvasDoPacote(
  pacote: PacoteApuracao,
  mes: number,
  ano: number,
) {
  const unidades = pacote.unidades.filter(
    (unidade) => !ehUnidadeCondominio(unidade) && unidade.faturas[0],
  );
  const { atual, previa } = indexarLeiturasPorPeriodo(
    unidades.flatMap((unidade) =>
      (unidade.leituras ?? []).map((leitura) => ({
        ...leitura,
        unidadeId: unidade.id,
      })),
    ),
    mes,
    ano,
  );
  const consumos = consumosDasLeituras(
    unidades.map((unidade) => unidade.id),
    atual,
    previa,
  );

  return unidades.map((unidade) => {
    const fatura = unidade.faturas[0];
    const morador = escolherMoradorNaCompetencia(
      unidade.historicoMoradores ?? [],
      mes,
      ano,
    );

    return {
      ...fatura,
      unidade: {
        id: unidade.id,
        numero: unidade.numero,
        blocoId: unidade.blocoId,
        nomeMorador: morador?.nomeMorador ?? unidade.nomeMorador ?? "",
        celular: morador?.celular ?? unidade.celular ?? "",
        bloco: unidade.bloco,
        tipoUnidade: {
          nome: unidade.tipoUnidade.nome,
        },
      },
      consumoAguaM3: consumos.agua.get(unidade.id) ?? 0,
      consumoGasM3: consumos.gas.get(unidade.id) ?? 0,
    };
  });
}

function consumosDasLeituras(
  unidadeIds: string[],
  atual: Map<string, LeituraPeriodo>,
  previa: Map<string, LeituraPeriodo>,
) {
  const agua = new Map<string, number>();
  const gas = new Map<string, number>();

  for (const unidadeId of unidadeIds) {
    const leituraAtual = atual.get(unidadeId);
    const leituraPrevia = previa.get(unidadeId);
    agua.set(
      unidadeId,
      consumoLeitura(leituraAtual?.valorAgua, leituraPrevia?.valorAgua),
    );
    gas.set(
      unidadeId,
      consumoM3(
        Number(leituraAtual?.valorGas ?? 0),
        Number(leituraPrevia?.valorGas ?? 0),
      ),
    );
  }

  return { agua, gas };
}

export async function listarDespesasPeriodo(
  condominioId: string,
  mes: number,
  ano: number,
  session?: SessionUser | null,
): Promise<DespesaPeriodoApuracao[]> {
  const despesas =
    (await prisma.despesaMensal.findMany({
      where: {
        condominioId,
        mes,
        ano,
        condominio: escopoTenant(session),
      },
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
  session?: SessionUser | null,
) {
  const pacote = await carregarPacoteApuracao(condominioId, mes, ano, session);

  if (!pacote) {
    return [];
  }

  return montarFaturasSalvasDoPacote(pacote, mes, ano);
}

export async function processarApuracao(
  condominioId: string,
  mes: number,
  ano: number,
  opcoes?: {
    persistir?: boolean;
    pacote?: PacoteApuracao;
    recusarSeFechado?: boolean;
    session?: SessionUser | null;
  },
) {
  const persistir = opcoes?.persistir !== false;

  if (
    opcoes?.recusarSeFechado &&
    (await movimentoEstaFechado(condominioId, mes, ano))
  ) {
    return {
      error:
        "O movimento deste mês está fechado. Reabra o movimento para recalcular a apuração.",
      status: 409 as const,
    };
  }

  const condominio =
    opcoes?.pacote ??
    (await carregarPacoteApuracao(condominioId, mes, ano, opcoes?.session));

  if (!condominio) {
    return { error: "Condomínio não encontrado.", status: 404 as const };
  }

  const unidades = condominio.unidades;
  const despesas = condominio.despesasMensais;
  const registrosRegras = condominio.tiposDespesa.flatMap((tipo) => tipo.regras);

  if (unidades.length === 0) {
    return {
      error: "Não há unidades cadastradas neste condomínio.",
      status: 400 as const,
    };
  }

  if (despesas.length === 0) {
    return {
      error: "Não há despesas cadastradas para este condomínio no mês selecionado.",
      status: 400 as const,
    };
  }
  const regras: Set<string> = new Set(
    registrosRegras.map((regra) =>
      chaveParticipacao(regra.tipoUnidadeId, regra.tipoDespesaId),
    ),
  );
  const tiposComRegra = new Set(
    registrosRegras.map((regra) => regra.tipoDespesaId),
  );

  const { atual: leiturasMes, previa: leiturasMesAnterior } =
    indexarLeiturasPorPeriodo(
      unidades.flatMap((unidade) =>
        (unidade.leituras ?? []).map((leitura) => ({
          ...leitura,
          unidadeId: unidade.id,
        })),
      ),
      mes,
      ano,
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
  const consumoGasPorUnidade = consumosDasLeituras(
    unidadesPrivativas.map((unidade) => unidade.id),
    leiturasMes,
    leiturasMesAnterior,
  ).gas;

  const faturas = unidadesPrivativas.map((unidade) => {
    const atual = valores.get(unidade.id) ?? valoresZerados();
    const valorAgua = arredondarMoeda(atual.valorAgua);
    const valorEnergia = arredondarMoeda(atual.valorEnergia);
    const valorGas = Number(atual.valorGas);
    const valorOutras = arredondarMoeda(atual.valorOutras);
    const valorTotal = arredondarMoeda(
      valorAgua + valorEnergia + valorGas + valorOutras,
    );
    const morador = escolherMoradorNaCompetencia(
      unidade.historicoMoradores ?? [],
      mes,
      ano,
    );

    return {
      id: `${unidade.id}-${mes}-${ano}`,
      unidadeId: unidade.id,
      mes,
      ano,
      valorAgua,
      valorEnergia,
      valorGas,
      valorOutras,
      valorTotal,
      unidade: {
        id: unidade.id,
        numero: unidade.numero,
        blocoId: unidade.blocoId,
        nomeMorador: morador?.nomeMorador ?? unidade.nomeMorador ?? "",
        celular: morador?.celular ?? unidade.celular ?? "",
        bloco: unidade.bloco,
        tipoUnidade: {
          nome: unidade.tipoUnidade.nome,
        },
      },
      consumoAguaM3: consumoAgua.get(unidade.id) ?? 0,
      consumoGasM3: consumoGasPorUnidade.get(unidade.id) ?? 0,
    };
  });

  if (persistir) {
    await prisma.$transaction(async (tx) => {
      await tx.faturaUnidade.deleteMany({
        where: {
          mes,
          ano,
          unidade: { condominioId },
        },
      });

      if (faturas.length > 0) {
        await tx.faturaUnidade.createMany({
          data: faturas.map((fatura) => ({
            unidadeId: fatura.unidadeId,
            mes: fatura.mes,
            ano: fatura.ano,
            valorAgua: fatura.valorAgua,
            valorEnergia: fatura.valorEnergia,
            valorGas: fatura.valorGas,
            valorOutras: fatura.valorOutras,
            valorTotal: fatura.valorTotal,
          })),
        });
      }
    });
  }

  const despesasPeriodo = mapearDespesasPeriodo(despesas);
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
  session?: SessionUser | null,
) {
  const pacote = await carregarPacoteApuracao(condominioId, mes, ano, session);

  if (!pacote) {
    return {
      movimento: { fechado: false as const },
      faturas: [] as Awaited<ReturnType<typeof listarFaturasApuracao>>,
      despesasPeriodo: [] as Awaited<ReturnType<typeof listarDespesasPeriodo>>,
      resumo: null,
      error: "Condomínio não encontrado.",
      status: 404 as const,
    };
  }

  const fechado = await movimentoEstaFechado(condominioId, mes, ano);

  if (fechado) {
    const faturas = montarFaturasSalvasDoPacote(pacote, mes, ano);
    const despesasPeriodo = mapearDespesasPeriodo(pacote.despesasMensais);

    return {
      movimento: { fechado: true as const },
      faturas,
      despesasPeriodo,
      resumo: faturas.length > 0 ? montarResumoDeFaturas(faturas) : null,
    };
  }

  const resultado = await processarApuracao(condominioId, mes, ano, {
    persistir: false,
    pacote,
    session,
  });

  if ("error" in resultado) {
    return {
      movimento: { fechado: false as const },
      faturas: [] as Awaited<ReturnType<typeof listarFaturasApuracao>>,
      despesasPeriodo: [] as Awaited<ReturnType<typeof listarDespesasPeriodo>>,
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
