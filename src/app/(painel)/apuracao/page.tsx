import { prisma } from "@/lib/prisma";
import ApuracaoScreen from "./ApuracaoScreen";

export const dynamic = "force-dynamic";

export default async function ApuracaoPage() {
  const condominios = await prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <ApuracaoScreen condominios={condominios} />;
}
