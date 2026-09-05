import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  chaveNomeBloco,
  NOME_BLOCO_PADRAO,
  persistirBloco,
} from "../src/lib/blocos";

const prisma = new PrismaClient();

const ADMIN_NOME = "Administrador";
const ADMIN_EMAIL = "iandreao1308@gmail.com";
const ADMIN_SENHA = "Admin1308";

const TIPOS_UNIDADE = [
  "Apartamento",
  "Sala",
  "Loja",
  "Vaga de Garagem",
  "Condomínio",
];

const TIPOS_DESPESA = [
  "Água",
  "Água Condominio",
  "Gás",
  "Material Diversos",
  "Serviço Faxina",
  "Manutenções",
  "Energia Condominio",
  "Outras Despesas",
];

const TIPOS_DESPESA_LOJA = [
  "Água",
  "Água Condominio",
  "Gás",
  "Material Diversos",
  "Outras Despesas",
];

async function colunaExiste(tabela: string, coluna: string) {
  const rows = await prisma.$queryRaw<Array<{ presente: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tabela}
        AND column_name = ${coluna}
    ) AS presente
  `;

  return Boolean(rows[0]?.presente);
}

async function tabelaExiste(tabela: string) {
  const rows = await prisma.$queryRaw<Array<{ presente: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tabela}
    ) AS presente
  `;

  return Boolean(rows[0]?.presente);
}

async function migrarColunasAntigas() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TipoUnidade" (
      "id" TEXT NOT NULL,
      "nome" TEXT NOT NULL,
      CONSTRAINT "TipoUnidade_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TipoUnidade_nome_key" ON "TipoUnidade"("nome")
  `);

  const temNomeUnidade = await colunaExiste("Unidade", "tipoUnidade");
  const temIdUnidade = await colunaExiste("Unidade", "tipoUnidadeId");

  if (temNomeUnidade && !temIdUnidade) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Unidade" ADD COLUMN "tipoUnidadeId" TEXT`,
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO "TipoUnidade" ("id", "nome")
      SELECT gen_random_uuid()::text, nomes.nome
      FROM (
        SELECT DISTINCT "tipoUnidade" AS nome
        FROM "Unidade"
        WHERE "tipoUnidade" IS NOT NULL AND btrim("tipoUnidade") <> ''
      ) AS nomes
      ON CONFLICT ("nome") DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Unidade" AS u
      SET "tipoUnidadeId" = t."id"
      FROM "TipoUnidade" AS t
      WHERE t."nome" = u."tipoUnidade"
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "TipoUnidade" ("id", "nome")
      VALUES (gen_random_uuid()::text, 'Apartamento')
      ON CONFLICT ("nome") DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Unidade"
      SET "tipoUnidadeId" = (
        SELECT "id" FROM "TipoUnidade" WHERE "nome" = 'Apartamento' LIMIT 1
      )
      WHERE "tipoUnidadeId" IS NULL
    `);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Unidade" ALTER COLUMN "tipoUnidadeId" SET NOT NULL`,
    );
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Unidade"
        ADD CONSTRAINT "Unidade_tipoUnidadeId_fkey"
        FOREIGN KEY ("tipoUnidadeId") REFERENCES "TipoUnidade"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already exists")) {
        throw error;
      }
    }
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Unidade" DROP COLUMN "tipoUnidade"`,
    );
  }

  if (!(await tabelaExiste("RegraParticipacao"))) {
    return;
  }

  const temNomeRegra = await colunaExiste("RegraParticipacao", "tipoUnidade");
  const temIdRegra = await colunaExiste("RegraParticipacao", "tipoUnidadeId");

  if (temNomeRegra && !temIdRegra) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "RegraParticipacao" ADD COLUMN "tipoUnidadeId" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "RegraParticipacao" ADD COLUMN "tipoDespesaId" TEXT`,
    );
    await prisma.$executeRawUnsafe(`
      UPDATE "RegraParticipacao" AS r
      SET "tipoUnidadeId" = t."id"
      FROM "TipoUnidade" AS t
      WHERE t."nome" = r."tipoUnidade"
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "RegraParticipacao" AS r
      SET "tipoDespesaId" = t."id"
      FROM "TipoDespesa" AS t
      WHERE t."nome" = r."tipoDespesa"
    `);
    await prisma.$executeRawUnsafe(`
      DELETE FROM "RegraParticipacao"
      WHERE "tipoUnidadeId" IS NULL OR "tipoDespesaId" IS NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RegraParticipacao"
      ALTER COLUMN "tipoUnidadeId" SET NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RegraParticipacao"
      ALTER COLUMN "tipoDespesaId" SET NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RegraParticipacao"
      DROP CONSTRAINT IF EXISTS "RegraParticipacao_tipoUnidade_tipoDespesa_key"
    `);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "RegraParticipacao" DROP COLUMN "tipoUnidade"`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "RegraParticipacao" DROP COLUMN "tipoDespesa"`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "RegraParticipacao_tipoUnidadeId_tipoDespesaId_key"
      ON "RegraParticipacao"("tipoUnidadeId", "tipoDespesaId")
    `);
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RegraParticipacao"
        ADD CONSTRAINT "RegraParticipacao_tipoUnidadeId_fkey"
        FOREIGN KEY ("tipoUnidadeId") REFERENCES "TipoUnidade"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already exists")) {
        throw error;
      }
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RegraParticipacao"
        ADD CONSTRAINT "RegraParticipacao_tipoDespesaId_fkey"
        FOREIGN KEY ("tipoDespesaId") REFERENCES "TipoDespesa"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already exists")) {
        throw error;
      }
    }
  }
}

async function migrarEscopoCondominio() {
  const condominios = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Condominio" ORDER BY "createdAt" ASC
  `;

  if (condominios.length === 0) {
    return;
  }

  const primeiro = condominios[0].id;

  if (!(await colunaExiste("TipoUnidade", "condominioId"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TipoUnidade" ADD COLUMN "condominioId" TEXT`,
    );
  }

  if (!(await colunaExiste("TipoDespesa", "condominioId"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TipoDespesa" ADD COLUMN "condominioId" TEXT`,
    );
  }

  await prisma.$executeRaw`
    UPDATE "TipoUnidade" SET "condominioId" = ${primeiro} WHERE "condominioId" IS NULL
  `;
  await prisma.$executeRaw`
    UPDATE "TipoDespesa" SET "condominioId" = ${primeiro} WHERE "condominioId" IS NULL
  `;

  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoUnidade_nome_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoDespesa_nome_key"`,
  );

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TipoUnidade" ALTER COLUMN "condominioId" SET NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TipoDespesa" ALTER COLUMN "condominioId" SET NOT NULL
    `);
  } catch {
    // coluna já NOT NULL
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TipoUnidade"
      ADD CONSTRAINT "TipoUnidade_condominioId_fkey"
      FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TipoDespesa"
      ADD CONSTRAINT "TipoDespesa_condominioId_fkey"
      FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }

  if (!(await colunaExiste("TipoUnidade", "blocoId"))) {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TipoUnidade_nome_condominioId_key"
      ON "TipoUnidade"("nome", "condominioId")
    `);
  }

  if (!(await colunaExiste("TipoDespesa", "blocoId"))) {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TipoDespesa_nome_condominioId_key"
      ON "TipoDespesa"("nome", "condominioId")
    `);
  }
}

async function removerIndicesUnicosObsoletosDeTipos() {
  const obsoletos = [
    ["TipoUnidade", "TipoUnidade_nome_key"],
    ["TipoUnidade", "TipoUnidade_nome_condominioId_key"],
    ["TipoUnidade", "TipoUnidade_nome_condominioId_bloco_key"],
    ["TipoDespesa", "TipoDespesa_nome_key"],
    ["TipoDespesa", "TipoDespesa_nome_condominioId_key"],
    ["TipoDespesa", "TipoDespesa_nome_condominioId_bloco_key"],
  ] as const;

  for (const [tabela, nome] of obsoletos) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${nome}"`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tabela}" DROP CONSTRAINT IF EXISTS "${nome}"`,
    );
  }

  if (await colunaExiste("TipoUnidade", "blocoId")) {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TipoUnidade_nome_condominioId_blocoId_key"
      ON "TipoUnidade"("nome", "condominioId", "blocoId")
    `);
  }

  if (await colunaExiste("TipoDespesa", "blocoId")) {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TipoDespesa_nome_condominioId_blocoId_key"
      ON "TipoDespesa"("nome", "condominioId", "blocoId")
    `);
  }
}

async function migrarEscopoBloco() {
  if (await colunaExiste("TipoUnidade", "blocoId")) {
    await removerIndicesUnicosObsoletosDeTipos();
    return;
  }

  if (!(await colunaExiste("TipoUnidade", "bloco"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TipoUnidade" ADD COLUMN "bloco" TEXT NOT NULL DEFAULT ''`,
    );
  }

  if (!(await colunaExiste("TipoDespesa", "bloco"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TipoDespesa" ADD COLUMN "bloco" TEXT NOT NULL DEFAULT ''`,
    );
  }

  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoUnidade_nome_condominioId_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoDespesa_nome_condominioId_key"`,
  );

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TipoUnidade_nome_condominioId_bloco_key"
    ON "TipoUnidade"("nome", "condominioId", "bloco")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TipoDespesa_nome_condominioId_bloco_key"
    ON "TipoDespesa"("nome", "condominioId", "bloco")
  `);
}

async function garantirTiposDoEscopo(condominioId: string, blocoId: string) {
  for (const nome of TIPOS_UNIDADE) {
    await prisma.tipoUnidade.upsert({
      where: {
        nome_condominioId_blocoId: { nome, condominioId, blocoId },
      },
      update: {},
      create: { nome, condominioId, blocoId },
    });
  }

  for (const nome of TIPOS_DESPESA) {
    await prisma.tipoDespesa.upsert({
      where: {
        nome_condominioId_blocoId: { nome, condominioId, blocoId },
      },
      update: {},
      create: { nome, condominioId, blocoId },
    });
  }

  const tiposUnidade = await prisma.tipoUnidade.findMany({
    where: { condominioId, blocoId },
  });
  const tiposDespesa = await prisma.tipoDespesa.findMany({
    where: { condominioId, blocoId },
  });
  const unidadePorNome = new Map(tiposUnidade.map((item) => [item.nome, item]));
  const despesaPorNome = new Map(tiposDespesa.map((item) => [item.nome, item]));
  const apartamento = unidadePorNome.get("Apartamento");
  const loja = unidadePorNome.get("Loja");

  if (apartamento) {
    for (const nome of TIPOS_DESPESA) {
      const tipoDespesa = despesaPorNome.get(nome);

      if (!tipoDespesa) {
        continue;
      }

      await prisma.regraParticipacao.upsert({
        where: {
          tipoUnidadeId_tipoDespesaId: {
            tipoUnidadeId: apartamento.id,
            tipoDespesaId: tipoDespesa.id,
          },
        },
        update: {},
        create: {
          tipoUnidadeId: apartamento.id,
          tipoDespesaId: tipoDespesa.id,
        },
      });
    }
  }

  if (loja) {
    for (const nome of TIPOS_DESPESA_LOJA) {
      const tipoDespesa = despesaPorNome.get(nome);

      if (!tipoDespesa) {
        continue;
      }

      await prisma.regraParticipacao.upsert({
        where: {
          tipoUnidadeId_tipoDespesaId: {
            tipoUnidadeId: loja.id,
            tipoDespesaId: tipoDespesa.id,
          },
        },
        update: {},
        create: {
          tipoUnidadeId: loja.id,
          tipoDespesaId: tipoDespesa.id,
        },
      });
    }
  }
}

async function garantirTabelaBloco() {
  if (await tabelaExiste("Bloco")) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Bloco" (
      "id" TEXT NOT NULL,
      "nome" TEXT NOT NULL,
      "condominioId" TEXT NOT NULL,
      CONSTRAINT "Bloco_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Bloco_nome_condominioId_key"
    ON "Bloco"("nome", "condominioId")
  `);

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Bloco"
      ADD CONSTRAINT "Bloco_condominioId_fkey"
      FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
}

async function nomesBlocoAntigos() {
  const tabelas = ["Unidade", "TipoUnidade", "TipoDespesa", "DespesaMensal"];
  const pares: Array<{ condominioId: string; nome: string }> = [];

  for (const tabela of tabelas) {
    if (!(await colunaExiste(tabela, "bloco"))) {
      continue;
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ condominioId: string; bloco: string | null }>
    >(`SELECT DISTINCT "condominioId", "bloco" FROM "${tabela}"`);

    for (const row of rows) {
      pares.push({
        condominioId: row.condominioId,
        nome: (row.bloco ?? "").trim() || NOME_BLOCO_PADRAO,
      });
    }
  }

  return pares;
}

async function migrarModeloBlocoRelacional() {
  await garantirTabelaBloco();

  const tabelas = ["Unidade", "TipoUnidade", "TipoDespesa", "DespesaMensal"];

  for (const tabela of tabelas) {
    if (!(await colunaExiste(tabela, "blocoId"))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tabela}" ADD COLUMN "blocoId" TEXT`,
      );
    }
  }

  const condominios = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Condominio"
  `;
  const pares = await nomesBlocoAntigos();
  const porCondominio = new Map<string, Map<string, string>>();

  for (const condominio of condominios) {
    porCondominio.set(
      condominio.id,
      new Map([[persistirBloco(NOME_BLOCO_PADRAO), NOME_BLOCO_PADRAO]]),
    );
  }

  for (const par of pares) {
    const mapa =
      porCondominio.get(par.condominioId) ??
      new Map([[persistirBloco(NOME_BLOCO_PADRAO), NOME_BLOCO_PADRAO]]);
    const chave = chaveNomeBloco(par.nome);

    if (!mapa.has(chave)) {
      mapa.set(chave, par.nome.trim() || NOME_BLOCO_PADRAO);
    }

    porCondominio.set(par.condominioId, mapa);
  }

  for (const [condominioId, nomes] of porCondominio) {
    for (const nome of nomes.values()) {
      await prisma.bloco.upsert({
        where: { nome_condominioId: { nome, condominioId } },
        update: {},
        create: { nome, condominioId },
      });
    }
  }

  const blocos = await prisma.bloco.findMany({
    select: { id: true, nome: true, condominioId: true },
  });
  const idPorChave = new Map(
    blocos.map((item) => [
      `${item.condominioId}::${chaveNomeBloco(item.nome)}`,
      item.id,
    ]),
  );

  for (const tabela of tabelas) {
    if (!(await colunaExiste(tabela, "bloco"))) {
      continue;
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; condominioId: string; bloco: string | null }>
    >(`SELECT id, "condominioId", "bloco" FROM "${tabela}" WHERE "blocoId" IS NULL`);

    for (const row of rows) {
      const blocoId =
        idPorChave.get(`${row.condominioId}::${chaveNomeBloco(row.bloco)}`) ??
        idPorChave.get(`${row.condominioId}::${persistirBloco(NOME_BLOCO_PADRAO)}`);

      if (!blocoId) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "${tabela}" SET "blocoId" = $1 WHERE id = $2`,
        blocoId,
        row.id,
      );
    }
  }

  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "Unidade_condominioId_bloco_numero_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoUnidade_nome_condominioId_bloco_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoDespesa_nome_condominioId_bloco_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "DespesaMensal_condominioId_bloco_mes_ano_tipoDespesaId_key"`,
  );

  for (const tabela of tabelas) {
    if (await colunaExiste(tabela, "bloco")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tabela}" DROP COLUMN "bloco"`);
    }

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tabela}" ALTER COLUMN "blocoId" SET NOT NULL`,
      );
    } catch {
      // já NOT NULL ou ainda sem linhas
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Unidade_condominioId_blocoId_numero_key"
    ON "Unidade"("condominioId", "blocoId", "numero")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TipoUnidade_nome_condominioId_blocoId_key"
    ON "TipoUnidade"("nome", "condominioId", "blocoId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TipoDespesa_nome_condominioId_blocoId_key"
    ON "TipoDespesa"("nome", "condominioId", "blocoId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DespesaMensal_condominioId_blocoId_mes_ano_tipoDespesaId_key"
    ON "DespesaMensal"("condominioId", "blocoId", "mes", "ano", "tipoDespesaId")
  `);

  for (const tabela of tabelas) {
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${tabela}"
        ADD CONSTRAINT "${tabela}_blocoId_fkey"
        FOREIGN KEY ("blocoId") REFERENCES "Bloco"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already exists")) {
        throw error;
      }
    }
  }
}

async function garantirUsuarioAdmin() {
  const email = ADMIN_EMAIL.toLowerCase();
  const senha = await bcrypt.hash(ADMIN_SENHA, 10);

  await prisma.usuario.upsert({
    where: { email },
    update: { nome: ADMIN_NOME, senha },
    create: {
      nome: ADMIN_NOME,
      email,
      senha,
    },
  });
}

async function main() {
  await garantirUsuarioAdmin();
  await migrarColunasAntigas();
  await migrarEscopoCondominio();
  await migrarEscopoBloco();
  await migrarModeloBlocoRelacional();
  await removerIndicesUnicosObsoletosDeTipos();

  const condominios = await prisma.condominio.findMany({
    select: { id: true },
  });

  for (const condominio of condominios) {
    const padrao = await prisma.bloco.upsert({
      where: {
        nome_condominioId: {
          nome: NOME_BLOCO_PADRAO,
          condominioId: condominio.id,
        },
      },
      update: {},
      create: { nome: NOME_BLOCO_PADRAO, condominioId: condominio.id },
    });

    await garantirTiposDoEscopo(condominio.id, padrao.id);

    const demaisBlocos = await prisma.bloco.findMany({
      where: { condominioId: condominio.id, NOT: { id: padrao.id } },
      select: { id: true },
    });

    for (const bloco of demaisBlocos) {
      await garantirTiposDoEscopo(condominio.id, bloco.id);
    }
  }

  const unidades = await prisma.unidade.findMany({
    select: {
      id: true,
      blocoId: true,
      condominioId: true,
      tipoUnidadeId: true,
      tipoUnidade: { select: { nome: true, condominioId: true, blocoId: true } },
    },
  });

  for (const unidade of unidades) {
    const mesmoEscopo =
      unidade.tipoUnidade.condominioId === unidade.condominioId &&
      unidade.tipoUnidade.blocoId === unidade.blocoId;

    if (mesmoEscopo) {
      continue;
    }

    const copia = await prisma.tipoUnidade.upsert({
      where: {
        nome_condominioId_blocoId: {
          nome: unidade.tipoUnidade.nome,
          condominioId: unidade.condominioId,
          blocoId: unidade.blocoId,
        },
      },
      update: {},
      create: {
        nome: unidade.tipoUnidade.nome,
        condominioId: unidade.condominioId,
        blocoId: unidade.blocoId,
      },
    });

    await prisma.unidade.update({
      where: { id: unidade.id },
      data: { tipoUnidadeId: copia.id },
    });
  }

  const despesas = await prisma.despesaMensal.findMany({
    select: {
      id: true,
      blocoId: true,
      condominioId: true,
      tipoDespesaId: true,
      tipoDespesa: { select: { nome: true, condominioId: true, blocoId: true } },
    },
  });

  for (const despesa of despesas) {
    const mesmoEscopo =
      despesa.tipoDespesa.condominioId === despesa.condominioId &&
      despesa.tipoDespesa.blocoId === despesa.blocoId;

    if (mesmoEscopo) {
      continue;
    }

    const copia = await prisma.tipoDespesa.upsert({
      where: {
        nome_condominioId_blocoId: {
          nome: despesa.tipoDespesa.nome,
          condominioId: despesa.condominioId,
          blocoId: despesa.blocoId,
        },
      },
      update: {},
      create: {
        nome: despesa.tipoDespesa.nome,
        condominioId: despesa.condominioId,
        blocoId: despesa.blocoId,
      },
    });

    await prisma.despesaMensal.update({
      where: { id: despesa.id },
      data: { tipoDespesaId: copia.id },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
