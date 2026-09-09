import { PrismaClient } from "@prisma/client";
import { normalizarDatabaseUrl, urlNeonComPoolerESsl } from "@/lib/neon-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function criarPrismaClient() {
  const url = process.env.DATABASE_URL
    ? urlNeonComPoolerESsl(normalizarDatabaseUrl(process.env.DATABASE_URL))
    : "";

  if (!url) {
    throw new Error("DATABASE_URL não configurado.");
  }

  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? criarPrismaClient();

globalForPrisma.prisma = prisma;

export function getPrisma() {
  return prisma;
}
