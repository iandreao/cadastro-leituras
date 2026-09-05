import { prisma } from "@/lib/prisma";
import CondominioScreen from "@/components/CondominioScreen";

export const dynamic = "force-dynamic";

export default async function CondominiosPage() {
  const registros = await prisma.condominio.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      unidades: {
        select: {
          _count: {
            select: { leituras: true },
          },
        },
      },
    },
  });

  const condominios = registros.map(({ unidades, ...condominio }) => ({
    ...condominio,
    temLeitura: unidades.some((unidade) => unidade._count.leituras > 0),
  }));

  return <CondominioScreen inicial={condominios} />;
}
