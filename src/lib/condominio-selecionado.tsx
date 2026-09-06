"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "condominio-selecionado";

type Selecao = {
  id: string;
  nome: string;
};

type Contexto = {
  selecionado: Selecao | null;
  publicar: (selecao: Selecao | null) => void;
};

const CondominioSelecionadoContext = createContext<Contexto | null>(null);

function lerStorage(): Selecao | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Selecao;

    if (!parsed?.id || !parsed?.nome) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function gravarStorage(selecao: Selecao | null) {
  if (!selecao) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selecao));
}

export function CondominioSelecionadoProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selecionado, setSelecionado] = useState<Selecao | null>(null);

  useEffect(() => {
    setSelecionado(lerStorage());
  }, []);

  const publicar = useCallback((selecao: Selecao | null) => {
    setSelecionado(selecao);
    gravarStorage(selecao);
  }, []);

  return (
    <CondominioSelecionadoContext.Provider value={{ selecionado, publicar }}>
      {children}
    </CondominioSelecionadoContext.Provider>
  );
}

export function useCondominioSelecionado() {
  const contexto = useContext(CondominioSelecionadoContext);

  if (!contexto) {
    return {
      selecionado: null,
      publicar: () => undefined,
    };
  }

  return contexto;
}

export function usePublicarCondominio(
  condominioId: string,
  condominios: { id: string; nome: string }[],
) {
  const { publicar } = useCondominioSelecionado();
  const inicio = useRef(true);

  useEffect(() => {
    if (inicio.current) {
      inicio.current = false;

      if (!condominioId) {
        return;
      }
    }

    if (!condominioId) {
      publicar(null);
      return;
    }

    const item = condominios.find(
      (condominio) => String(condominio.id) === String(condominioId),
    );

    if (item) {
      publicar({ id: item.id, nome: item.nome });
    }
  }, [condominioId, condominios, publicar]);
}
