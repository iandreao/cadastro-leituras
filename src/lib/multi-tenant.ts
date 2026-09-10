import { PrismaClient, Role } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export const GESTOR_PADRAO_ID = "default-master-gestor-id";
export const GESTOR_PADRAO_NOME = "Administradora Master";
export const SUPER_ADMIN_EMAIL = "admin@condosys.com";
export const EMAILS_SUPER_ADMIN_INICIAIS = [
  SUPER_ADMIN_EMAIL,
  "iandreao1308@gmail.com",
];

type ClienteSql = {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
};

let schemaPronto = false;

function jaExiste(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("já existe")
  );
}

async function executarSePossivel(db: ClienteSql, sql: string) {
  try {
    await db.$executeRawUnsafe(sql);
  } catch (error) {
    if (!jaExiste(error)) {
      throw error;
    }
  }
}

export async function garantirSchemaMultiTenant(db: ClienteSql = getPrisma()) {
  if (schemaPronto && db === getPrisma()) {
    return;
  }

  await executarSePossivel(
    db,
    `DO $$ BEGIN
       CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'GESTOR_ADMIN', 'OPERADOR');
     EXCEPTION
       WHEN duplicate_object THEN NULL;
     END $$;`,
  );

  await executarSePossivel(
    db,
    `CREATE TABLE IF NOT EXISTS "Gestor" (
       "id" TEXT NOT NULL,
       "nomeFantasia" TEXT NOT NULL,
       "razaoSocial" TEXT,
       "cnpj" TEXT,
       "ativo" BOOLEAN NOT NULL DEFAULT true,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "Gestor_pkey" PRIMARY KEY ("id")
     )`,
  );
  await executarSePossivel(
    db,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Gestor_cnpj_key" ON "Gestor"("cnpj")`,
  );

  await executarSePossivel(
    db,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'OPERADOR'`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gestorId" TEXT`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "Condominio" ADD COLUMN IF NOT EXISTS "gestorId" TEXT`,
  );
  await executarSePossivel(
    db,
    `CREATE INDEX IF NOT EXISTS "users_gestorId_idx" ON "users"("gestorId")`,
  );
  await executarSePossivel(
    db,
    `CREATE INDEX IF NOT EXISTS "Condominio_gestorId_idx" ON "Condominio"("gestorId")`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "users"
     ADD CONSTRAINT "users_gestorId_fkey"
     FOREIGN KEY ("gestorId") REFERENCES "Gestor"("id")
     ON DELETE RESTRICT ON UPDATE CASCADE`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "Condominio"
     ADD CONSTRAINT "Condominio_gestorId_fkey"
     FOREIGN KEY ("gestorId") REFERENCES "Gestor"("id")
     ON DELETE RESTRICT ON UPDATE CASCADE`,
  );

  if (db === getPrisma()) {
    schemaPronto = true;
  }
}

export async function garantirTenantPadrao(
  db: PrismaClient = getPrisma(),
) {
  await garantirSchemaMultiTenant(db);

  await db.gestor.upsert({
    where: { id: GESTOR_PADRAO_ID },
    update: {
      nomeFantasia: GESTOR_PADRAO_NOME,
      ativo: true,
    },
    create: {
      id: GESTOR_PADRAO_ID,
      nomeFantasia: GESTOR_PADRAO_NOME,
    },
  });

  await db.condominio.updateMany({
    where: { gestorId: null },
    data: { gestorId: GESTOR_PADRAO_ID },
  });

  await db.usuario.updateMany({
    where: { gestorId: null },
    data: { gestorId: GESTOR_PADRAO_ID },
  });

  await promoverSuperAdminsConhecidos(EMAILS_SUPER_ADMIN_INICIAIS, db);
}

export async function promoverSuperAdminsConhecidos(
  emails: string[],
  db: PrismaClient = getPrisma(),
) {
  const lista = emails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (lista.length === 0) {
    return;
  }

  await db.usuario.updateMany({
    where: { email: { in: lista } },
    data: {
      role: Role.SUPER_ADMIN,
      gestorId: GESTOR_PADRAO_ID,
    },
  });
}
