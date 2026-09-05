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
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </CondominioSelecionadoProvider>
  );
}
