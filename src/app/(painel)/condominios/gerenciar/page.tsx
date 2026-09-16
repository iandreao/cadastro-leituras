import { Suspense } from "react";
import GerenciarCadastroScreen from "@/components/GerenciarCadastroScreen";
import { getSession } from "@/lib/session";

export default async function GerenciarCadastroPage() {
  const session = await getSession();

  return (
    <Suspense fallback={null}>
      <GerenciarCadastroScreen
        role={session?.role ?? "OPERADOR"}
        gestorIdSessao={session?.gestorId ?? ""}
      />
    </Suspense>
  );
}
