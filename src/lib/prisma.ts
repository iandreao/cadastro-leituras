import { PrismaClient } from "@prisma/client";
import { urlNeonComPoolerESsl } from "@/lib/neon-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error("DATABASE_URL não configurado.");
  }

  const urlNeon = urlNeonComPoolerESsl(url);

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: { url: urlNeon },
      },
    });
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    return Reflect.get(client, property, client);
  },
});
