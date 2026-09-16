"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TiposDespesaScreen from "@/app/(painel)/configuracoes/tipos-despesas/TiposDespesaScreen";
import DespesaScreen from "@/app/(painel)/despesas/DespesaScreen";
import { useCompetenciaSelecionada } from "@/lib/competencia-selecionada";
import { useCondominioSelecionado } from "@/lib/condominio-selecionado";

const ABAS = [
  { id: "tipos", label: "Tipos de Despesas" },
  { id: "mes", label: "Despesas do Mês" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function parseAba(valor: string | null): AbaId {
  return valor === "mes" ? "mes" : "tipos";
}

export default function GerenciarDespesasScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aba = parseAba(searchParams.get("aba"));
  const { selecionado } = useCondominioSelecionado();
  const { competencia, hidratado } = useCompetenciaSelecionada();
  const condominioIdInicial = selecionado?.id ?? "";

  const irPara = useCallback(
    (id: AbaId) => {
      const params = new URLSearchParams(searchParams.toString());

      if (id === "tipos") {
        params.delete("aba");
      } else {
        params.set("aba", id);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100vh-2rem)]">
      <div
        role="tablist"
        aria-label="Cadastro de despesas"
        className="flex shrink-0 flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
      >
        {ABAS.map((item) => {
          const ativo = aba === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => irPara(item.id)}
              className={`rounded-lg px-4 py-2.5 text-base font-bold transition ${
                ativo
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" role="tabpanel">
        {!hidratado ? null : aba === "tipos" ? (
          <TiposDespesaScreen
            condominioIdInicial={condominioIdInicial}
            embutido
          />
        ) : (
          <DespesaScreen
            condominiosIniciais={[]}
            tiposIniciais={[]}
            blocosIniciais={[]}
            despesasIniciais={[]}
            condominioIdInicial={condominioIdInicial}
            mesInicial={competencia.mes}
            anoInicial={competencia.ano}
            embutido
          />
        )}
      </div>
    </div>
  );
}
