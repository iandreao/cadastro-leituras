import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  const energias = await prisma.tipoDespesa.findMany({
    where: { nome: "Energia" },
  });

  for (const energia of energias) {
    const aguaCondominio = await prisma.tipoDespesa.findUnique({
      where: {
        nome_condominioId_blocoId: {
          nome: "Água Condominio",
          condominioId: energia.condominioId,
          blocoId: energia.blocoId,
        },
      },
    });

    if (!aguaCondominio) {
      await prisma.tipoDespesa.update({
        where: { id: energia.id },
        data: { nome: "Água Condominio" },
      });
    } else {
      await prisma.despesaMensal.updateMany({
        where: { tipoDespesaId: energia.id },
        data: { tipoDespesaId: aguaCondominio.id },
      });
      await prisma.tipoDespesa.delete({ where: { id: energia.id } });
    }
  }

  const condominios = await prisma.condominio.findMany({
    select: { id: true, blocos: { select: { id: true } } },
  });

  for (const condominio of condominios) {
    for (const bloco of condominio.blocos) {
      for (const nome of TIPOS_DESPESA) {
        await prisma.tipoDespesa.upsert({
          where: {
            nome_condominioId_blocoId: {
              nome,
              condominioId: condominio.id,
              blocoId: bloco.id,
            },
          },
          update: {},
          create: {
            nome,
            condominioId: condominio.id,
            blocoId: bloco.id,
          },
        });
      }
    }
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
