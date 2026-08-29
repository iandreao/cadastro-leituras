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
  const energia = await prisma.tipoDespesa.findUnique({
    where: { nome: "Energia" },
  });
  const aguaCondominio = await prisma.tipoDespesa.findUnique({
    where: { nome: "Água Condominio" },
  });

  if (energia && !aguaCondominio) {
    await prisma.tipoDespesa.update({
      where: { id: energia.id },
      data: { nome: "Água Condominio" },
    });
  } else if (energia && aguaCondominio) {
    await prisma.despesaMensal.updateMany({
      where: { tipoDespesaId: energia.id },
      data: { tipoDespesaId: aguaCondominio.id },
    });
    await prisma.tipoDespesa.delete({ where: { id: energia.id } });
  }

  for (const nome of TIPOS_DESPESA) {
    await prisma.tipoDespesa.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
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
