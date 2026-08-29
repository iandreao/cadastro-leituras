import { prisma } from "@/lib/prisma";
import LeituraGradeScreen from "@/components/LeituraGradeScreen";

export const dynamic = "force-dynamic";

export default async function LeituraAguaPage() {
  const condominios = await prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <LeituraGradeScreen tipo="agua" condominios={condominios} />;
}
