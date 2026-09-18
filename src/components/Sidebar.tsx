"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCondominioSelecionado } from "@/lib/condominio-selecionado";
import { classeTagRole, rotuloRole } from "@/lib/roles-ui";

type DocumentoTelaCheia = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElementoTelaCheia = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function elementoEmTelaCheia() {
  const doc = document as DocumentoTelaCheia;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function IconeExpandir() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
    </svg>
  );
}

function IconeRecolher() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3v4H5M15 3v4h4M9 21v-4H5M15 21v-4h4" />
    </svg>
  );
}

const itens: { href: string; label: string; roles?: string[] }[] = [
  { href: "/condominios/gerenciar", label: "Incluir Condomínio" },
  { href: "/despesas/gerenciar", label: "Incluir Despesas" },
  { href: "/leituras/gerenciar", label: "Incluir Leituras" },
  { href: "/apuracao", label: "Apurar Despesas do Mês" },
  {
    href: "/admin/movimentos",
    label: "Fechamento de Mês",
    roles: ["SUPER_ADMIN", "GESTOR_ADMIN"],
  },
  {
    href: "/admin/usuarios",
    label: "Incluir Usuários",
    roles: ["SUPER_ADMIN", "GESTOR_ADMIN"],
  },
  {
    href: "/admin/gestores",
    label: "Incluir Cliente Gestor",
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/admin/vincular-condominio",
    label: "Trocar Gestor do Condomínio",
    roles: ["SUPER_ADMIN"],
  },
];

export default function Sidebar({
  role = "OPERADOR",
  nome = "",
}: {
  role?: string;
  nome?: string;
}) {
  const pathname = usePathname();
  const { selecionado } = useCondominioSelecionado();
  const nomeCondominio = selecionado?.nome ?? "Selecione um Condomínio";
  const [telaCheia, setTelaCheia] = useState(false);

  useEffect(() => {
    function sincronizar() {
      setTelaCheia(Boolean(elementoEmTelaCheia()));
    }

    sincronizar();
    document.addEventListener("fullscreenchange", sincronizar);
    document.addEventListener(
      "webkitfullscreenchange" as "fullscreenchange",
      sincronizar,
    );

    return () => {
      document.removeEventListener("fullscreenchange", sincronizar);
      document.removeEventListener(
        "webkitfullscreenchange" as "fullscreenchange",
        sincronizar,
      );
    };
  }, []);

  const alternarTelaCheia = useCallback(async () => {
    const doc = document as DocumentoTelaCheia;
    const raiz = document.documentElement as ElementoTelaCheia;

    try {
      if (elementoEmTelaCheia()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else {
          await doc.webkitExitFullscreen?.();
        }
        return;
      }

      if (raiz.requestFullscreen) {
        await raiz.requestFullscreen();
      } else {
        await raiz.webkitRequestFullscreen?.();
      }
    } catch {
      // Navegador recusou ou não suporta Fullscreen API.
    }
  }, []);

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
    <aside className="flex h-full w-full shrink-0 flex-col bg-[#0b3b4a] text-white lg:h-screen lg:w-72">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium tracking-[0.2em] text-teal-200 uppercase">
          GESTÃO DE CONDOMÍNIO
        </p>
        <p className="mt-1.5 truncate text-sm text-teal-100/80">
          {nomeCondominio}
        </p>
        <button
          type="button"
          onClick={() => void alternarTelaCheia()}
          aria-pressed={telaCheia}
          title={telaCheia ? "Sair da tela cheia" : "Tela Cheia"}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-teal-50/90 transition hover:bg-white/10 hover:text-white"
        >
          {telaCheia ? <IconeRecolher /> : <IconeExpandir />}
          Tela Cheia
        </button>
        {nome ? (
          <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
            <p className="truncate text-sm font-medium text-white" title={nome}>
              {nome}
            </p>
            <span
              className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${classeTagRole(role)}`}
            >
              {rotuloRole(role)}
            </span>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-col space-y-1 overflow-y-auto px-3 py-2">
        {itens
          .filter((item) => !item.roles || item.roles.includes(role))
          .map((item) => {
          const ativo =
            pathname.startsWith(item.href) ||
            (item.href.endsWith("/gerenciar") &&
              pathname.startsWith(item.href.slice(0, -"/gerenciar".length)));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-base font-semibold transition ${
                ativo
                  ? "bg-white/15 text-white"
                  : "text-teal-50/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={sair}
          className="w-full rounded-lg border border-white/15 px-3 py-2 text-base font-semibold text-teal-50 transition hover:bg-white/10"
        >
          Sair
        </button>
      </nav>
    </aside>
  );
}
