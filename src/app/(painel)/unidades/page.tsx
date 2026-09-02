import { prisma } from "@/lib/prisma";
import UnidadeScreen from "@/components/UnidadeScreen";

export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  const [condominios, unidades] = await Promise.all([
    prisma.condominio.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, nome: true },
    }),
    prisma.unidade.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        condominio: {
          select: { id: true, nome: true },
        },
        tipoUnidade: {
          select: { id: true, nome: true },
        },
        bloco: {
          select: { id: true, nome: true },
        },
        _count: {
          select: { leituras: true },
        },
      },
    }),
  ]);

  return (
    <UnidadeScreen
      condominiosIniciais={condominios}
      unidadesIniciais={unidades}
      tiposIniciais={[]}
    />
  );
}
