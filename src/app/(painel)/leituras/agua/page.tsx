import { listarCondominiosResumo } from "@/lib/cache-cadastro";
import LeituraGradeScreen from "@/components/LeituraGradeScreen";

export const dynamic = "force-dynamic";

export default async function LeituraAguaPage() {
  const condominios = await listarCondominiosResumo();

  return <LeituraGradeScreen tipo="agua" condominios={condominios} />;
}
