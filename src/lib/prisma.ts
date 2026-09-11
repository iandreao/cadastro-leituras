import { PrismaClient } from "@prisma/client";
import { normalizarDatabaseUrl, urlNeonComPoolerESsl } from "@/lib/neon-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Singleton: reutiliza a conexão Neon entre hot-reloads e invocações. */

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

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = criarPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client as object, property, client);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});
