import { Prisma } from "@prisma/client";
import { toTitleCase } from "@/lib/masks";
import { limitesCompetencia } from "@/lib/periodo";
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

  if (chaveMorador(nomeNovo) === chaveMorador(unidade.nomeMorador)) {
    if (aberto) {
      await atualizarAberto(aberto.id, {
        nomeMorador: nomeNovo || aberto.nomeMorador,
        celular: celularNovo,
        email: emailNovo,
      });
      return;
    }

    if (nomeNovo.trim()) {
      await criarRegistro({
        unidadeId: unidade.id,
        nomeMorador: nomeNovo,
        email: emailNovo,
        celular: celularNovo,
        dataEntrada: unidade.createdAt ?? agora,
        dataSaida: null,
      });
    }

    return;
  }

  if (aberto) {
    await fecharRegistro(aberto.id, agora);
  } else if (chaveMorador(unidade.nomeMorador)) {
    await criarRegistro({
      unidadeId: unidade.id,
      nomeMorador: toTitleCase(unidade.nomeMorador),
      email: "",
      celular: unidade.celular,
      dataEntrada: unidade.createdAt ?? agora,
      dataSaida: agora,
    });
  }

  if (!nomeNovo.trim()) {
    return;
  }

  await criarRegistro({
    unidadeId: unidade.id,
    nomeMorador: nomeNovo,
    email: emailNovo,
    celular: celularNovo,
    dataEntrada: agora,
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
  const repo = repoHistorico();
  let linhas: Array<{
    unidadeId: string;
    nomeMorador: string;
    celular: string;
    email: string;
  }> = [];

  try {
    if (typeof repo?.findMany === "function") {
      const registros = (await repo.findMany({
        where: {
          unidadeId: { in: unidadeIds },
          dataEntrada: { lte: fim },
          OR: [{ dataSaida: null }, { dataSaida: { gt: inicio } }],
        },
        orderBy: { dataEntrada: "desc" },
        select: {
          unidadeId: true,
          nomeMorador: true,
          celular: true,
          email: true,
        },
      })) as Array<{
        unidadeId: string;
        nomeMorador: string;
        celular: string;
        email: string;
      }>;

      linhas = registros;
    } else {
      linhas = await getPrisma().$queryRaw<
        Array<{
          unidadeId: string;
          nomeMorador: string;
          celular: string;
          email: string;
        }>
      >`
        SELECT DISTINCT ON ("unidadeId")
          "unidadeId", "nomeMorador", celular, email
        FROM "HistoricoMorador"
        WHERE "unidadeId" IN (${Prisma.join(unidadeIds)})
          AND "dataEntrada" <= ${fim}
          AND ("dataSaida" IS NULL OR "dataSaida" > ${inicio})
        ORDER BY "unidadeId", "dataEntrada" DESC
      `;
    }
  } catch (error) {
    console.error("[historico-morador] consulta na competência", error);
    return mapa;
  }

  for (const linha of linhas) {
    if (mapa.has(linha.unidadeId)) {
      continue;
    }

    mapa.set(linha.unidadeId, {
      nomeMorador: linha.nomeMorador,
      celular: linha.celular,
      email: linha.email,
    });
  }

  return mapa;
}
