import { prisma } from "@/lib/prisma";
import TiposDespesaScreen from "./TiposDespesaScreen";

export const dynamic = "force-dynamic";

export default async function TiposDespesasPage() {
  const condominios = await prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <TiposDespesaScreen condominios={condominios} />;
}
