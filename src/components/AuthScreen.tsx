"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Modo = "login" | "cadastro";

const camposIniciais = {
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
};

export default function AuthScreen() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("login");
  const [form, setForm] = useState(camposIniciais);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      const url = modo === "login" ? "/api/auth/login" : "/api/auth/cadastro";
      const payload =
        modo === "login"
          ? { email: form.email, senha: form.senha }
          : form;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível continuar.");
        return;
      }

      router.push("/condominios");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b3b4a] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/20" />
        <div className="absolute -bottom-16 left-10 h-64 w-64 rounded-full bg-amber-400/15" />

        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-teal-100 uppercase">
            Água e Gás
          </p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight">
            Cadastro de Leituras
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-teal-50/80">
            Controle condomínios, unidades e medições em um único fluxo, com
            validação de CNPJ na Receita Federal.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-teal-50/90">
          <li className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-teal-300" />
            Inclusão de condomínios com consulta automática de CNPJ
          </li>
          <li className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            Unidades vinculadas e protegidas contra exclusão indevida
          </li>
        </ul>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">
              Água e Gás
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Cadastro de Leituras
            </h1>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setModo("login");
                setErro("");
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                modo === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("cadastro");
                setErro("");
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                modo === "cadastro"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Criar conta
            </button>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            {modo === "login" ? "Acesse o sistema" : "Cadastre-se"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {modo === "login"
              ? "Use o e-mail e a senha da sua conta."
              : "Preencha os dados para criar o primeiro acesso."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {modo === "cadastro" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nome
                </span>
                <input
                  required
                  value={form.nome}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, nome: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  placeholder="Seu nome"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail
              </span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, email: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                placeholder="voce@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Senha
              </span>
              <input
                required
                type="password"
                minLength={modo === "cadastro" ? 6 : undefined}
                value={form.senha}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, senha: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                placeholder="••••••••"
              />
            </label>

            {modo === "cadastro" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirmar senha
                </span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={form.confirmarSenha}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      confirmarSenha: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  placeholder="••••••••"
                />
              </label>
            )}

            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {enviando
                ? "Aguarde..."
                : modo === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
