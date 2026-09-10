import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { CondominioSelecionadoProvider } from "@/lib/condominio-selecionado";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <CondominioSelecionadoProvider>
      <div className="min-h-screen lg:flex lg:h-screen">
        <Sidebar nome={session.nome} role={session.role} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4">
          {children}
        </main>
      </div>
    </CondominioSelecionadoProvider>
  );
}
