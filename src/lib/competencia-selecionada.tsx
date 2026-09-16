"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { inteiroPeriodo, periodoBrasil } from "@/lib/periodo";

const STORAGE_KEY = "competencia-selecionada";

export type Competencia = {
  mes: number;
  ano: number;
};

type Contexto = {
  competencia: Competencia;
  hidratado: boolean;
  publicar: (competencia: Competencia) => void;
};

const CompetenciaSelecionadaContext = createContext<Contexto | null>(null);

function competenciaValida(valor: unknown): valor is Competencia {
  if (!valor || typeof valor !== "object") {
    return false;
  }

  const mes = inteiroPeriodo((valor as Competencia).mes);
  const ano = inteiroPeriodo((valor as Competencia).ano);

  return (
    Number.isInteger(mes) &&
    mes >= 1 &&
    mes <= 12 &&
    Number.isInteger(ano) &&
    ano >= 2000
  );
}

function lerStorage(): Competencia | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Competencia;
    return competenciaValida(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function gravarStorage(competencia: Competencia) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(competencia));
}

export function CompetenciaSelecionadaProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [competencia, setCompetencia] = useState<Competencia>(periodoBrasil);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    const salvo = lerStorage();

    if (salvo) {
      setCompetencia(salvo);
    }

    setHidratado(true);
  }, []);

  const publicar = useCallback((proximo: Competencia) => {
    if (!competenciaValida(proximo)) {
      return;
    }

    setCompetencia(proximo);
    gravarStorage(proximo);
  }, []);

  return (
    <CompetenciaSelecionadaContext.Provider
      value={{ competencia, hidratado, publicar }}
    >
      {children}
    </CompetenciaSelecionadaContext.Provider>
  );
}

export function useCompetenciaSelecionada() {
  const contexto = useContext(CompetenciaSelecionadaContext);
  const padrao = periodoBrasil();

  if (!contexto) {
    return {
      competencia: padrao,
      hidratado: true,
      publicar: () => undefined,
    };
  }

  return contexto;
}

export function usePublicarCompetencia(
  mes: number | string | "",
  ano: number | string | "",
) {
  const { publicar, hidratado } = useCompetenciaSelecionada();

  useEffect(() => {
    if (!hidratado) {
      return;
    }
    const mesN = inteiroPeriodo(mes);
    const anoN = inteiroPeriodo(ano);

    if (
      !Number.isInteger(mesN) ||
      mesN < 1 ||
      mesN > 12 ||
      !Number.isInteger(anoN) ||
      anoN < 2000
    ) {
      return;
    }

    publicar({ mes: mesN, ano: anoN });
  }, [ano, hidratado, mes, publicar]);
}
