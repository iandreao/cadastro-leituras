import { prisma } from "@/lib/prisma";
import TiposUnidadeScreen from "./TiposUnidadeScreen";

export const dynamic = "force-dynamic";

export default async function TiposUnidadesPage() {
  const condominios = await prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <TiposUnidadeScreen condominios={condominios} />;
}
