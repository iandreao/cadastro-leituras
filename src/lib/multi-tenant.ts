import { PrismaClient, Role } from "@prisma/client";
import type { RoleSessao, SessionUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const GESTOR_PADRAO_ID = "default-master-gestor-id";
export const GESTOR_PADRAO_NOME = "Administradora Master";
export const SUPER_ADMIN_EMAIL = "ivalinoandreao567@gmail.com";
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

  await executarSePossivel(
    db,
    `ALTER TABLE "MovimentoMensal" ADD COLUMN IF NOT EXISTS "gestorId" TEXT`,
  );
  await executarSePossivel(
    db,
    `UPDATE "MovimentoMensal" AS m
     SET "gestorId" = c."gestorId"
     FROM "Condominio" AS c
     WHERE c."id" = m."condominioId"
       AND (m."gestorId" IS NULL OR m."gestorId" = '')`,
  );
  await executarSePossivel(
    db,
    `UPDATE "MovimentoMensal"
     SET "gestorId" = '${GESTOR_PADRAO_ID}'
     WHERE "gestorId" IS NULL OR "gestorId" = ''`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "MovimentoMensal" ALTER COLUMN "gestorId" SET NOT NULL`,
  );
  await executarSePossivel(
    db,
    `CREATE INDEX IF NOT EXISTS "MovimentoMensal_gestorId_idx" ON "MovimentoMensal"("gestorId")`,
  );
  await executarSePossivel(
    db,
    `ALTER TABLE "MovimentoMensal"
     ADD CONSTRAINT "MovimentoMensal_gestorId_fkey"
     FOREIGN KEY ("gestorId") REFERENCES "Gestor"("id")
     ON DELETE RESTRICT ON UPDATE CASCADE`,
  );
  await executarSePossivel(
    db,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MovimentoMensal_mes_ano_gestorId_key"
     ON "MovimentoMensal"("mes", "ano", "gestorId")`,
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

const TENANT_INEXISTENTE = "__sem_gestor__";

export function ehSuperAdmin(session: Pick<SessionUser, "role"> | null | undefined) {
  return session?.role === "SUPER_ADMIN";
}

export function escopoTenant(
  session: Pick<SessionUser, "role" | "gestorId"> | null | undefined,
): { gestorId?: string } {
  if (ehSuperAdmin(session)) {
    return {};
  }

  const gestorId = session?.gestorId?.trim();

  if (!gestorId) {
    return { gestorId: TENANT_INEXISTENTE };
  }

  return { gestorId };
}

export function viaCondominio(
  session: Pick<SessionUser, "role" | "gestorId"> | null | undefined,
) {
  return { condominio: escopoTenant(session) };
}

export function viaUnidadeDoTenant(
  session: Pick<SessionUser, "role" | "gestorId"> | null | undefined,
) {
  return { unidade: viaCondominio(session) };
}

export async function completarSessaoTenant(session: SessionUser): Promise<SessionUser> {
  try {
    const usuario = await getPrisma().usuario.findUnique({
      where: { id: session.sub },
      select: { role: true, gestorId: true },
    });

    if (!usuario) {
      return session;
    }

    return {
      ...session,
      role: usuario.role as RoleSessao,
      gestorId: usuario.gestorId,
    };
  } catch {
    return session;
  }
}

export function omitirDadosGestor<T extends { gestorId?: unknown; gestor?: unknown }>(
  registro: T,
  session: Pick<SessionUser, "role"> | null | undefined,
) {
  if (ehSuperAdmin(session)) {
    return registro;
  }

  const { gestorId: _gestorId, gestor: _gestor, ...resto } = registro;
  return resto;
}

export async function resolverGestorIdDeCadastro(
  session: SessionUser,
  candidatoDoCliente?: unknown,
) {
  if (!ehSuperAdmin(session)) {
    return session.gestorId?.trim() || null;
  }

  const candidato =
    typeof candidatoDoCliente === "string" ? candidatoDoCliente.trim() : "";

  if (candidato) {
    const gestor = await getPrisma().gestor.findFirst({
      where: { id: candidato, ativo: true },
      select: { id: true },
    });

    if (gestor) {
      return gestor.id;
    }
  }

  return session.gestorId?.trim() || GESTOR_PADRAO_ID;
}

export async function buscarCondominioDoTenant(
  session: SessionUser,
  condominioId: string | null | undefined,
) {
  const id = condominioId?.trim() ?? "";

  if (!id) {
    return null;
  }

  return getPrisma().condominio.findFirst({
    where: { id, ...escopoTenant(session) },
    select: { id: true, gestorId: true },
  });
}
