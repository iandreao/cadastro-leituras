import { prisma } from "@/lib/prisma";
import DespesaScreen from "./DespesaScreen";

export const dynamic = "force-dynamic";

export default async function DespesasPage() {
  const [condominios, blocos, despesas] = await Promise.all([
    prisma.condominio.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.bloco.findMany({
      select: { id: true, nome: true, condominioId: true },
      orderBy: { nome: "asc" },
    }),
    prisma.despesaMensal.findMany({
      orderBy: [{ ano: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
      include: {
        condominio: {
          select: { id: true, nome: true },
        },
        tipoDespesa: {
          select: { id: true, nome: true },
        },
        bloco: {
          select: { id: true, nome: true, condominioId: true },
        },
      },
    }),
  ]);

  return (
    <DespesaScreen
      condominiosIniciais={condominios}
      tiposIniciais={[]}
      blocosIniciais={blocos}
      despesasIniciais={despesas}
    />
  );
}
