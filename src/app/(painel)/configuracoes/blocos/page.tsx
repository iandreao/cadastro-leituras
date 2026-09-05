import { prisma } from "@/lib/prisma";
import BlocosScreen from "./BlocosScreen";

export const dynamic = "force-dynamic";

export default async function BlocosPage() {
  const condominios = await prisma.condominio.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <BlocosScreen condominios={condominios} />;
}
