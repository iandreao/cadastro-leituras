import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RotaCarregando from "@/components/RotaCarregando";
import { CondominioSelecionadoProvider } from "@/lib/condominio-selecionado";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function PainelEsqueleto() {
  return (
    <div className="min-h-screen lg:flex lg:h-screen">
      <aside className="hidden w-full shrink-0 bg-[#0b3b4a] lg:block lg:h-screen lg:w-72" />
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4">
        <RotaCarregando />
      </main>
    </div>
  );
}

async function PainelAutenticado({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <CondominioSelecionadoProvider>
      <div className="min-h-screen lg:flex lg:h-screen">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4">
          {children}
        </main>
      </div>
    </CondominioSelecionadoProvider>
  );
}

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PainelEsqueleto />}>
      <PainelAutenticado>{children}</PainelAutenticado>
    </Suspense>
  );
}
