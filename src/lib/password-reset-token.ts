import { getPrisma } from "@/lib/prisma";

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

export async function apagarTokensPorEmail(email: string) {
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE email = ${email}
  `;
}

export async function apagarTokenPorValor(token: string) {
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE token = ${token}
  `;
}

export async function apagarTokenPorId(id: string) {
  await getPrisma().$executeRaw`
    DELETE FROM "password_reset_tokens" WHERE id = ${id}
  `;
}

export async function criarTokenRedefinicao(
  email: string,
  token: string,
  expires: Date,
) {
  await getPrisma().$executeRaw`
    INSERT INTO "password_reset_tokens" ("id", "email", "token", "expires", "createdAt")
    VALUES (${crypto.randomUUID()}, ${email}, ${token}, ${expires}, NOW())
  `;
}

export async function buscarTokenRedefinicao(token: string) {
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
