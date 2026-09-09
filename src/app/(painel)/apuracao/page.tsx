import { listarCondominiosResumo } from "@/lib/cache-cadastro";
import ApuracaoScreen from "./ApuracaoScreen";

export const dynamic = "force-dynamic";

export default async function ApuracaoPage() {
  const condominios = await listarCondominiosResumo();

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <ApuracaoScreen condominios={condominios} />
    </div>
  );
}
