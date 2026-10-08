"use client";

import { useEffect, useState } from "react";

export type CondominioResumo = {
  id: string;
  nome: string;
  chavePix?: string | null;
};

const TTL_RESUMO_MS = 20_000;

type CacheResumo = {
  dados: CondominioResumo[];
  expira: number;
};

let cacheResumo: CacheResumo | null = null;
let pedidoEmVoo: Promise<CondominioResumo[] | null> | null = null;

export function invalidarResumoCondominios() {
  cacheResumo = null;
}

async function buscarResumo() {
  if (cacheResumo && cacheResumo.expira > Date.now()) {
    return cacheResumo.dados;
  }

  if (!pedidoEmVoo) {
    pedidoEmVoo = fetch("/api/condominios?resumo=1")
      .then(async (response) => {
        const data = (await response.json()) as
          | CondominioResumo[]
          | { error?: string };

        if (!response.ok || !Array.isArray(data)) {
          return null;
        }

        cacheResumo = { dados: data, expira: Date.now() + TTL_RESUMO_MS };
        return data;
      })
      .catch(() => null)
      .finally(() => {
        pedidoEmVoo = null;
      });
  }

  return pedidoEmVoo;
}

export function useCondominiosResumo(iniciais: CondominioResumo[] = []) {
  const [condominios, setCondominios] = useState<CondominioResumo[]>(
    cacheResumo && cacheResumo.expira > Date.now() ? cacheResumo.dados : iniciais,
  );

  useEffect(() => {
    let ativo = true;

    void buscarResumo().then((dados) => {
      if (ativo && dados) {
        setCondominios(dados);
      }
    });

    return () => {
      ativo = false;
    };
  }, []);

  return condominios;
}
