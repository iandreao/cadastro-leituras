import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { viaUnidadeDoTenant } from "@/lib/multi-tenant";

export async function limparLeituras(session?: SessionUser) {
  if (!session) {
    return prisma.leitura.deleteMany({});
  }

  return prisma.leitura.deleteMany({
    where: viaUnidadeDoTenant(session),
  });
}

async function main() {
  const resultado = await limparLeituras();
  console.log(`Leituras excluídas: ${resultado.count}`);
}

const scriptAtual = process.argv[1]?.replaceAll("\\", "/");

if (scriptAtual?.endsWith("/limpar-leituras.ts")) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
