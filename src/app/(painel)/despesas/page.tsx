import { prisma } from "@/lib/prisma";
import { garantirTiposDespesa, TIPOS_DESPESA_PADRAO } from "@/lib/despesas";
import DespesaScreen from "./DespesaScreen";

export const dynamic = "force-dynamic";

export default async function DespesasPage() {
  await garantirTiposDespesa();

  const ordemTipos = new Map<string, number>(
    TIPOS_DESPESA_PADRAO.map((nome, indice) => [nome, indice]),
  );

  const [condominios, tipos, unidades, despesas] = await Promise.all([
    prisma.condominio.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.tipoDespesa.findMany({
      select: { id: true, nome: true },
    }),
    prisma.unidade.findMany({
      select: { id: true, bloco: true, condominioId: true },
      orderBy: [{ bloco: "asc" }, { numero: "asc" }],
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
      },
    }),
  ]);

  tipos.sort(
    (a, b) => (ordemTipos.get(a.nome) ?? 99) - (ordemTipos.get(b.nome) ?? 99),
  );

  return (
    <DespesaScreen
      condominiosIniciais={condominios}
      tiposIniciais={tipos}
      unidadesIniciais={unidades}
      despesasIniciais={despesas}
    />
  );
}
