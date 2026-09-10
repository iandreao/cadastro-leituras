import CondominioScreen from "@/components/CondominioScreen";
import { getSession } from "@/lib/session";

export default async function CondominiosPage() {
  const session = await getSession();

  return (
    <CondominioScreen
      inicial={[]}
      role={session?.role ?? "OPERADOR"}
      gestorIdSessao={session?.gestorId ?? ""}
    />
  );
}
