import { prisma } from "@/lib/prisma";

export async function limparLeituras() {
  return prisma.leitura.deleteMany({});
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
