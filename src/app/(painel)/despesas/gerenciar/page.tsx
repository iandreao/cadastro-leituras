import { Suspense } from "react";
import GerenciarDespesasScreen from "@/components/GerenciarDespesasScreen";

export default function GerenciarDespesasPage() {
  return (
    <Suspense fallback={null}>
      <GerenciarDespesasScreen />
    </Suspense>
  );
}
