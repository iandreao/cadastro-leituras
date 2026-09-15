import Sidebar from "@/components/Sidebar";
import { CondominioSelecionadoProvider } from "@/lib/condominio-selecionado";
import { exigirSessaoLiberada } from "@/lib/exigir-sessao-painel";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await exigirSessaoLiberada();

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
