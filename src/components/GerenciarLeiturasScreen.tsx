"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LeituraGradeScreen from "@/components/LeituraGradeScreen";
import { useCompetenciaSelecionada } from "@/lib/competencia-selecionada";
import { useCondominioSelecionado } from "@/lib/condominio-selecionado";
import { ABA_LISTA, classeAba } from "@/lib/ui-form";

const ABAS = [
  { id: "agua", label: "Leitura de Água" },
  { id: "gas", label: "Leitura de Gás" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function parseAba(valor: string | null): AbaId {
  return valor === "gas" ? "gas" : "agua";
}

export default function GerenciarLeiturasScreen() {
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

      if (id === "agua") {
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
        aria-label="Leituras do condomínio"
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
              className={classeAba(ativo)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" role="tabpanel">
        {hidratado ? (
          <LeituraGradeScreen
            key={aba}
            tipo={aba}
            condominioIdInicial={condominioIdInicial}
            mesInicial={competencia.mes}
            anoInicial={competencia.ano}
            embutido
          />
        ) : null}
      </div>
    </div>
  );
}
