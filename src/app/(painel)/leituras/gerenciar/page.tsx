import { Suspense } from "react";
import GerenciarLeiturasScreen from "@/components/GerenciarLeiturasScreen";

export default function GerenciarLeiturasPage() {
  return (
    <Suspense fallback={null}>
      <GerenciarLeiturasScreen />
    </Suspense>
  );
}
