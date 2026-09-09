import { Prisma } from "@prisma/client";
import { toTitleCase } from "@/lib/masks";
import { anoMesBrasil, chaveCompetencia, limitesCompetencia } from "@/lib/periodo";
import { getPrisma } from "@/lib/prisma";

export type MoradorPeriodo = {
  nomeMorador: string;
  celular: string;
  email: string;
};

type UnidadeMoradorAtual = {
  id: string;
  nomeMorador: string;
  celular: string;
  createdAt: Date;
};

type HistoricoLinha = {
  id: string;
  unidadeId: string;
  nomeMorador: string;
  email: string;
  celular: string;
  dataEntrada: Date;
  dataSaida: Date | null;
};

const INICIO_OCUPACAO_HISTORICO = new Date(Date.UTC(2000, 0, 1, 3, 0, 0, 0));

function chaveMorador(nome: string) {
  return nome.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function repoHistorico() {
  const client = getPrisma() as {
    historicoMorador?: {
      findFirst?: Function;
      findMany?: Function;
      create?: Function;
      update?: Function;
    };
  };

  return client.historicoMorador;
}

function ocupaCompetencia(
  linha: Pick<HistoricoLinha, "dataEntrada" | "dataSaida">,
  mes: number,
  ano: number,
) {
  const competencia = chaveCompetencia(mes, ano);
  const entradaMes = anoMesBrasil(linha.dataEntrada);
  const saidaMes = linha.dataSaida
    ? anoMesBrasil(linha.dataSaida)
    : Number.POSITIVE_INFINITY;

  return entradaMes <= competencia && saidaMes >= competencia;
}

async function buscarAberto(unidadeId: string): Promise<HistoricoLinha | null> {
  const repo = repoHistorico();

  if (typeof repo?.findFirst === "function") {
    return (await repo.findFirst({
      where: { unidadeId, dataSaida: null },
      orderBy: { dataEntrada: "desc" },
    })) as HistoricoLinha | null;
  }

  const linhas = await getPrisma().$queryRaw<HistoricoLinha[]>`
    SELECT id, "unidadeId", "nomeMorador", email, celular, "dataEntrada", "dataSaida"
    FROM "HistoricoMorador"
    WHERE "unidadeId" = ${unidadeId}
      AND "dataSaida" IS NULL
    ORDER BY "dataEntrada" DESC
    LIMIT 1
  `;

  return linhas[0] ?? null;
}

async function fecharRegistro(id: string, dataSaida: Date) {
  const repo = repoHistorico();

  if (typeof repo?.update === "function") {
    await repo.update({
      where: { id },
      data: { dataSaida },
    });
    return;
  }

  await getPrisma().$executeRaw`
    UPDATE "HistoricoMorador"
    SET "dataSaida" = ${dataSaida}
    WHERE id = ${id}
  `;
}

async function criarRegistro(dados: {
  unidadeId: string;
  nomeMorador: string;
  email: string;
  celular: string;
  dataEntrada: Date;
  dataSaida?: Date | null;
}) {
  const repo = repoHistorico();

  if (typeof repo?.create === "function") {
    await repo.create({ data: dados });
    return;
  }

  await getPrisma().$executeRaw`
    INSERT INTO "HistoricoMorador"
      ("id", "unidadeId", "nomeMorador", "email", "celular", "dataEntrada", "dataSaida")
    VALUES
      (${crypto.randomUUID()}, ${dados.unidadeId}, ${dados.nomeMorador}, ${dados.email}, ${dados.celular}, ${dados.dataEntrada}, ${dados.dataSaida ?? null})
  `;
}

async function atualizarAberto(
  id: string,
  dados: { celular: string; email: string; nomeMorador: string },
) {
  const repo = repoHistorico();

  if (typeof repo?.update === "function") {
    await repo.update({
      where: { id },
      data: dados,
    });
    return;
  }

  await getPrisma().$executeRaw`
    UPDATE "HistoricoMorador"
    SET celular = ${dados.celular},
        email = ${dados.email},
        "nomeMorador" = ${dados.nomeMorador}
    WHERE id = ${id}
  `;
}

export async function registrarMoradorNaUnidade(
  unidade: UnidadeMoradorAtual,
  proximo: { nomeMorador: string; celular: string; email?: string },
) {
  try {
    await registrarMoradorNaUnidadeInterno(unidade, proximo);
  } catch (error) {
    console.error("[historico-morador] falha ao registrar morador", error);
  }
}

async function registrarMoradorNaUnidadeInterno(
  unidade: UnidadeMoradorAtual,
  proximo: { nomeMorador: string; celular: string; email?: string },
) {
  const nomeNovo = toTitleCase(proximo.nomeMorador);
  const celularNovo = proximo.celular;
  const emailNovo = (proximo.email ?? "").trim().toLowerCase();
  const agora = new Date();
  const aberto = await buscarAberto(unidade.id);

  if (!chaveMorador(nomeNovo)) {
    if (aberto) {
      await fecharRegistro(aberto.id, agora);
    }
    return;
  }

  if (aberto && chaveMorador(aberto.nomeMorador) === chaveMorador(nomeNovo)) {
    await atualizarAberto(aberto.id, {
      nomeMorador: nomeNovo,
      celular: celularNovo,
      email: emailNovo,
    });
    return;
  }

  let houveTroca = false;

  if (aberto) {
    await fecharRegistro(aberto.id, agora);
    houveTroca = true;
  } else if (
    chaveMorador(unidade.nomeMorador) &&
    chaveMorador(unidade.nomeMorador) !== chaveMorador(nomeNovo)
  ) {
    await criarRegistro({
      unidadeId: unidade.id,
      nomeMorador: toTitleCase(unidade.nomeMorador),
      email: "",
      celular: unidade.celular,
      dataEntrada: INICIO_OCUPACAO_HISTORICO,
      dataSaida: agora,
    });
    houveTroca = true;
  }

  await criarRegistro({
    unidadeId: unidade.id,
    nomeMorador: nomeNovo,
    email: emailNovo,
    celular: celularNovo,
    dataEntrada: houveTroca ? agora : INICIO_OCUPACAO_HISTORICO,
    dataSaida: null,
  });
}

export async function garantirHistoricoInicial(unidade: UnidadeMoradorAtual) {
  if (!chaveMorador(unidade.nomeMorador)) {
    return;
  }

  await registrarMoradorNaUnidade(unidade, {
    nomeMorador: unidade.nomeMorador,
    celular: unidade.celular,
  });
}

export async function buscarMoradoresNaCompetencia(
  unidadeIds: string[],
  mes: number,
  ano: number,
) {
  const mapa = new Map<string, MoradorPeriodo>();

  if (unidadeIds.length === 0) {
    return mapa;
  }

  const { inicio, fim } = limitesCompetencia(mes, ano);
  const competencia = chaveCompetencia(mes, ano);

  try {
    const linhas = await getPrisma().$queryRaw<HistoricoLinha[]>`
      SELECT id, "unidadeId", "nomeMorador", email, celular, "dataEntrada", "dataSaida"
      FROM "HistoricoMorador"
      WHERE "unidadeId" IN (${Prisma.join(unidadeIds)})
      ORDER BY "unidadeId" ASC, "dataEntrada" ASC
    `;

    const porUnidade = new Map<string, HistoricoLinha[]>();

    for (const linha of linhas) {
      const normalizada: HistoricoLinha = {
        ...linha,
        dataEntrada: new Date(linha.dataEntrada),
        dataSaida: linha.dataSaida ? new Date(linha.dataSaida) : null,
      };
      const lista = porUnidade.get(normalizada.unidadeId) ?? [];
      lista.push(normalizada);
      porUnidade.set(normalizada.unidadeId, lista);
    }

    for (const [unidadeId, registros] of porUnidade) {
      const vigentes = registros.filter((linha) => {
        const noMes =
          linha.dataEntrada <= fim &&
          (linha.dataSaida == null || linha.dataSaida >= inicio);
        const noMesCalendario = ocupaCompetencia(linha, mes, ano);
        return noMes || noMesCalendario;
      });

      vigentes.sort(
        (a, b) => b.dataEntrada.getTime() - a.dataEntrada.getTime(),
      );

      let escolhido = vigentes[0];

      if (!escolhido) {
        const primeiro = registros[0];
        const entradaMes = anoMesBrasil(primeiro.dataEntrada);
        const saidaMes = primeiro.dataSaida
          ? anoMesBrasil(primeiro.dataSaida)
          : Number.POSITIVE_INFINITY;

        if (competencia < entradaMes && saidaMes >= competencia) {
          escolhido = primeiro;
        }
      }

      if (escolhido) {
        mapa.set(unidadeId, {
          nomeMorador: escolhido.nomeMorador,
          celular: escolhido.celular,
          email: escolhido.email,
        });
      }
    }
  } catch (error) {
    console.error("[historico-morador] consulta na competência", error);
  }

  return mapa;
}
