import { prisma } from "@/lib/prisma";

export const TIPO_UNIDADE_CONDOMINIO = "Condomínio";
export const TIPO_AGUA_FIXO = "Água Condominio";
export const TIPO_AGUA_VARIAVEL = "Água";
export const TIPO_GAS = "Gás";
export const TIPO_ENERGIA = "Energia Condominio";
export const TIPOS_OUTRAS_DESPESAS = [
  "Material Diversos",
  "Serviço Faxina",
  "Manutenções",
  "Outras Despesas",
] as const;

export const FATOR_CONVERSAO_GAS = 2.32;
export const DIVISOR_PRECO_M3_GAS = 20;

const includeFatura = {
  unidade: {
    select: {
      id: true,
      numero: true,
      bloco: true,
      nomeMorador: true,
      tipoUnidade: true,
    },
  },
} as const;

type UnidadeApuracao = {
  id: string;
  bloco: string;
  tipoUnidade: string;
};

type ValoresUnidade = {
  valorAgua: number;
  valorEnergia: number;
  valorGas: number;
  valorOutras: number;
};

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
  return unidade.tipoUnidade === TIPO_UNIDADE_CONDOMINIO;
}

function unidadeNoEscopo(unidade: UnidadeApuracao, blocoDespesa: string) {
  const bloco = blocoDespesa.trim();
  return bloco === "" || unidade.bloco.trim() === bloco;
}

function unidadesDoEscopo(
  unidades: UnidadeApuracao[],
  blocoDespesa: string,
  somenteRateio: boolean,
) {
  return unidades.filter((unidade) => {
    if (!unidadeNoEscopo(unidade, blocoDespesa)) {
      return false;
    }

    return somenteRateio ? !ehUnidadeCondominio(unidade) : true;
  });
}

function consumoLeitura(atual: number | null | undefined, anterior: number | null | undefined) {
  return Math.max(0, (atual ?? 0) - (anterior ?? 0));
}

function consumoGasM3(atual: number | null | undefined, anterior: number | null | undefined) {
  return (consumoLeitura(atual, anterior) / 1000) * FATOR_CONVERSAO_GAS;
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

  if (nome === TIPO_ENERGIA || nome === "Energia") {
    return "energia" as const;
  }

  if ((TIPOS_OUTRAS_DESPESAS as readonly string[]).includes(nome)) {
    return "outras" as const;
  }

  return "outras" as const;
}

function ratearIgual(
  valores: Map<string, ValoresUnidade>,
  unidades: UnidadeApuracao[],
  campo: Exclude<keyof ValoresUnidade, never>,
  valorTotal: number,
) {
  if (unidades.length === 0 || valorTotal <= 0) {
    return;
  }

  const parcela = valorTotal / unidades.length;

  for (const unidade of unidades) {
    const atual = valores.get(unidade.id);

    if (atual) {
      atual[campo] += parcela;
    }
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
      unidade: { condominioId },
    },
    orderBy: [{ unidade: { bloco: "asc" } }, { unidade: { numero: "asc" } }],
    include: includeFatura,
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
    orderBy: [{ bloco: "asc" }, { numero: "asc" }],
    select: {
      id: true,
      bloco: true,
      tipoUnidade: true,
    },
  });

  if (unidades.length === 0) {
    return {
      error: "Não há unidades cadastradas neste condomínio.",
      status: 400 as const,
    };
  }

  const anterior = periodoAnterior(mes, ano);

  const [despesas, leituras] = await Promise.all([
    prisma.despesaMensal.findMany({
      where: { condominioId, mes, ano },
      include: {
        tipoDespesa: { select: { nome: true } },
      },
    }),
    prisma.leitura.findMany({
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
    }),
  ]);

  const leituraAtual = new Map(
    leituras
      .filter((item) => item.mes === mes && item.ano === ano)
      .map((item) => [item.unidadeId, item]),
  );
  const leituraAnterior = new Map(
    leituras
      .filter((item) => item.mes === anterior.mes && item.ano === anterior.ano)
      .map((item) => [item.unidadeId, item]),
  );

  const consumoAgua = new Map<string, number>();
  const gasM3 = new Map<string, number>();
  const valores = new Map<string, ValoresUnidade>();

  for (const unidade of unidades) {
    const atual = leituraAtual.get(unidade.id);
    const previa = leituraAnterior.get(unidade.id);

    consumoAgua.set(
      unidade.id,
      consumoLeitura(atual?.valorAgua, previa?.valorAgua),
    );
    gasM3.set(unidade.id, consumoGasM3(atual?.valorGas, previa?.valorGas));
    valores.set(unidade.id, {
      valorAgua: 0,
      valorEnergia: 0,
      valorGas: 0,
      valorOutras: 0,
    });
  }

  for (const despesa of despesas) {
    const tipo = classificarDespesa(despesa.tipoDespesa.nome);
    const valor = Number(despesa.valorTotal);

    if (tipo === "agua_fixo") {
      ratearIgual(
        valores,
        unidadesDoEscopo(unidades, despesa.bloco, true),
        "valorAgua",
        valor,
      );
      continue;
    }

    if (tipo === "agua_variavel") {
      const escopo = unidadesDoEscopo(unidades, despesa.bloco, false);
      const somaConsumo = escopo.reduce(
        (total, unidade) => total + (consumoAgua.get(unidade.id) ?? 0),
        0,
      );

      if (somaConsumo <= 0 || valor <= 0) {
        continue;
      }

      const fuc = valor / somaConsumo;

      for (const unidade of escopo) {
        const atual = valores.get(unidade.id);

        if (atual) {
          atual.valorAgua += (consumoAgua.get(unidade.id) ?? 0) * fuc;
        }
      }

      continue;
    }

    if (tipo === "energia") {
      ratearIgual(
        valores,
        unidadesDoEscopo(unidades, despesa.bloco, true),
        "valorEnergia",
        valor,
      );
      continue;
    }

    if (tipo === "gas") {
      const escopo = unidadesDoEscopo(unidades, despesa.bloco, false);
      const precoM3 = valor / DIVISOR_PRECO_M3_GAS;

      for (const unidade of escopo) {
        const atual = valores.get(unidade.id);

        if (atual) {
          atual.valorGas += (gasM3.get(unidade.id) ?? 0) * precoM3;
        }
      }

      continue;
    }

    ratearIgual(
      valores,
      unidadesDoEscopo(unidades, despesa.bloco, true),
      "valorOutras",
      valor,
    );
  }

  await prisma.$transaction(
    unidades.map((unidade) => {
      const atual = valores.get(unidade.id) ?? {
        valorAgua: 0,
        valorEnergia: 0,
        valorGas: 0,
        valorOutras: 0,
      };
      const valorAgua = arredondarMoeda(atual.valorAgua);
      const valorEnergia = arredondarMoeda(atual.valorEnergia);
      const valorGas = arredondarMoeda(atual.valorGas);
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
  );

  const faturas = await listarFaturasApuracao(condominioId, mes, ano);

  return { faturas, despesas: despesas.length };
}
