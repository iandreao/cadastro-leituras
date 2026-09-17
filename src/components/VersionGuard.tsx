"use client";

import { useEffect } from "react";
import { APP_VERSION_KEY, CURRENT_VERSION } from "@/lib/app-version";

let verificacaoIniciada = false;

function limparCookiesVisiveis() {
  const cookies = document.cookie.split(";");

  for (const parte of cookies) {
    const nome = parte.split("=")[0]?.trim();

    if (!nome) {
      continue;
    }

    document.cookie = `${nome}=; Max-Age=0; path=/`;
    document.cookie = `${nome}=; Max-Age=0; path=/; secure; samesite=lax`;
  }
}

async function forcarLogoutPorVersao() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Cookie httpOnly pode falhar se a API não responder; a limpeza local segue.
  }

  localStorage.clear();
  sessionStorage.clear();
  limparCookiesVisiveis();
  localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
  window.location.replace("/login");
}

export default function VersionGuard() {
  useEffect(() => {
    if (verificacaoIniciada) {
      return;
    }

    const versaoSalva = localStorage.getItem(APP_VERSION_KEY);

    if (versaoSalva === CURRENT_VERSION) {
      return;
    }

    verificacaoIniciada = true;
    void forcarLogoutPorVersao();
  }, []);

  return null;
}
