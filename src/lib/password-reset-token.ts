import { getPrisma } from "@/lib/prisma";
import { garantirSchemaMultiTenant } from "@/lib/multi-tenant";

export type PasswordResetTokenRow = {
  id: string;
  email: string;
  token: string;
  expires: Date;
};

function asDate(valor: unknown) {
  if (valor instanceof Date) {
    return valor;
  }

  return new Date(String(valor ?? ""));
}

function mapearToken(row: {
  id: string;
  email: string;
  token: string;
  expires: unknown;
}): PasswordResetTokenRow {
  return {
    id: row.id,
    email: row.email,
    token: row.token,
    expires: asDate(row.expires),
  };
}

async function garantirTabelaTokens() {
  await garantirSchemaMultiTenant();
}

export async function apagarTokensPorEmail(email: string) {
  await garantirTabelaTokens();
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE email = ${email}
  `;
}

export async function apagarTokenPorValor(token: string) {
  await garantirTabelaTokens();
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE token = ${token}
  `;
}

export async function apagarTokenPorId(id: string) {
  await garantirTabelaTokens();
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE id = ${id}
  `;
}

export async function criarTokenRedefinicao(
  email: string,
  token: string,
  expires: Date,
) {
  await garantirTabelaTokens();
  await getPrisma().$executeRaw`
    INSERT INTO "password_reset_tokens" ("id", "email", "token", "expires", "createdAt")
    VALUES (${crypto.randomUUID()}, ${email}, ${token}, ${expires}, NOW())
  `;
}

export async function buscarTokenRedefinicao(token: string) {
  await garantirTabelaTokens();
  const rows = await getPrisma().$queryRaw<
    Array<{ id: string; email: string; token: string; expires: unknown }>
  >`
    SELECT id, email, token, expires
    FROM "password_reset_tokens"
    WHERE token = ${token}
    LIMIT 1
  `;

  const row = rows[0];
  return row ? mapearToken(row) : null;
}
