"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCondominioSelecionado } from "@/lib/condominio-selecionado";

const itens = [
  { href: "/condominios", label: "Incluir Condomínio" },
  { href: "/configuracoes/blocos", label: "Incluir Blocos / Torres" },
  { href: "/configuracoes/tipos-unidades", label: "Incluir Tipos de Unidade" },
  { href: "/unidades", label: "Incluir Unidade" },
  { href: "/configuracoes/tipos-despesas", label: "Incluir Tipos de Despesas" },
  { href: "/despesas", label: "Incluir Despesas do Mês" },
  { href: "/leituras/agua", label: "Inserir Leitura de Água" },
  { href: "/leituras/gas", label: "Inserir Leitura de Gás" },
  { href: "/apuracao", label: "Apurar Despesas do Mês" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { selecionado } = useCondominioSelecionado();
  const nomeCondominio = selecionado?.nome ?? "Selecione um Condomínio";

  async function sair() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(1000),
      });
    } catch {
      // Servidor desligado ou erro do Next.js: fecha a aba mesmo assim
    } finally {
      window.close();
      window.location.replace("about:blank");
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col bg-[#0b3b4a] text-white lg:h-screen lg:w-72">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-base font-medium tracking-[0.2em] text-teal-200 uppercase">
          GESTÃO DE CONDOMÍNIO
        </p>
        <p className="mt-3 truncate text-lg text-teal-100/80">{nomeCondominio}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {itens.map((item) => {
          const ativo = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 text-lg font-medium transition ${
                ativo
                  ? "bg-white/15 text-white"
                  : "text-teal-50/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={sair}
          className="w-full rounded-lg border border-white/15 px-3 py-2 text-lg font-medium text-teal-50 transition hover:bg-white/10"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
