import { listarBlocosResumo, listarCondominiosResumo } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import DespesaScreen from "./DespesaScreen";

export const dynamic = "force-dynamic";

export default async function DespesasPage() {
  const [condominios, blocos, despesas] = await Promise.all([
    listarCondominiosResumo(),
    listarBlocosResumo(),
    prisma.despesaMensal.findMany({
      orderBy: [{ ano: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        blocoId: true,
        mes: true,
        ano: true,
        valorTotal: true,
        valorFixo: true,
        valorVariavel: true,
        formaCobranca: true,
        condominioId: true,
        tipoDespesaId: true,
        condominio: { select: { id: true, nome: true } },
        tipoDespesa: { select: { id: true, nome: true } },
        bloco: { select: { id: true, nome: true, condominioId: true } },
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
