"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BlocosScreen from "@/app/(painel)/configuracoes/blocos/BlocosScreen";
import TiposUnidadeScreen from "@/app/(painel)/configuracoes/tipos-unidades/TiposUnidadeScreen";
import CondominioScreen from "@/components/CondominioScreen";
import UnidadeScreen from "@/components/UnidadeScreen";
import type { RoleSessao } from "@/lib/auth";
import { useCondominioSelecionado } from "@/lib/condominio-selecionado";
import { ABA_LISTA } from "@/lib/ui-form";

const ABAS = [
  { id: "condominios", label: "Condomínios" },
  { id: "blocos", label: "Blocos / Torres" },
  { id: "tipos-unidade", label: "Tipos de Unidade" },
  { id: "unidades", label: "Unidades" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function parseAba(valor: string | null): AbaId {
  if (
    valor === "blocos" ||
    valor === "tipos-unidade" ||
    valor === "unidades" ||
    valor === "condominios"
  ) {
    return valor;
  }

  return "condominios";
}

export default function GerenciarCadastroScreen({
  role,
  gestorIdSessao,
}: {
  role: RoleSessao;
  gestorIdSessao: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aba = parseAba(searchParams.get("aba"));
  const { selecionado } = useCondominioSelecionado();
  const condominioIdInicial = selecionado?.id ?? "";

  const irPara = useCallback(
    (id: AbaId) => {
      const params = new URLSearchParams(searchParams.toString());

      if (id === "condominios") {
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
        aria-label="Cadastro do condomínio"
        className={ABA_LISTA}
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
              className={`rounded-lg px-4 py-2.5 text-lg font-bold transition ${
                ativo
                  ? "bg-white text-teal-800 shadow-sm ring-1 ring-inset ring-teal-700/30"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" role="tabpanel">
        {aba === "condominios" ? (
          <CondominioScreen
            inicial={[]}
            role={role}
            gestorIdSessao={gestorIdSessao}
            embutido
          />
        ) : null}
        {aba === "blocos" ? (
          <BlocosScreen condominioIdInicial={condominioIdInicial} embutido />
        ) : null}
        {aba === "tipos-unidade" ? (
          <TiposUnidadeScreen
            condominioIdInicial={condominioIdInicial}
            embutido
          />
        ) : null}
        {aba === "unidades" ? (
          <UnidadeScreen
            condominiosIniciais={[]}
            unidadesIniciais={[]}
            tiposIniciais={[]}
            condominioIdInicial={condominioIdInicial}
            embutido
          />
        ) : null}
      </div>
    </div>
  );
}
