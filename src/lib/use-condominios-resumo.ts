"use client";

import { useEffect, useState } from "react";

export type CondominioResumo = {
  id: string;
  nome: string;
};

export function useCondominiosResumo(iniciais: CondominioResumo[] = []) {
  const [condominios, setCondominios] = useState<CondominioResumo[]>(iniciais);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const response = await fetch("/api/condominios?resumo=1");
        const data = (await response.json()) as CondominioResumo[] | { error?: string };

        if (ativo && response.ok && Array.isArray(data)) {
          setCondominios(data);
        }
      } catch {
        // A tela já está visível; o seletor fica vazio se a API falhar.
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  return condominios;
}
