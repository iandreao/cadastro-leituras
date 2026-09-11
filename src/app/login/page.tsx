"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFeedback } from "@/components/AuthFeedback";

type Modo = "login" | "cadastro";

const camposIniciais = {
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
};

const campoClass =
  "h-12 w-full rounded-lg border border-slate-300 p-4 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const rotuloClass = "mb-1 block text-base font-medium text-slate-700";

export default function LoginPage() {
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
          : {
              nome: form.nome,
              email: form.email,
              senha: form.senha,
              confirmarSenha: form.confirmarSenha,
            };

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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#0b3b4a] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/20" />
          <div className="absolute -bottom-16 left-10 h-64 w-64 rounded-full bg-amber-400/15" />

          <div>
            <h1 className="max-w-md text-3xl font-semibold leading-tight">
              Gestão de Condomínio
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-teal-50/80">
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

        <section className="flex items-center justify-center bg-[#f4f7f8] px-4 py-6">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm">
            <div className="mb-4 lg:hidden">
              <h1 className="text-2xl font-semibold text-slate-900">
                Gestão de Condomínio
              </h1>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setModo("login");
                  setErro("");
                }}
                className={`rounded-lg px-3 py-2.5 text-base font-medium transition ${
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
                className={`rounded-lg px-3 py-2.5 text-base font-medium transition ${
                  modo === "cadastro"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Criar conta
              </button>
            </div>

            <h2 className="text-3xl font-bold text-slate-900">
              {modo === "login" ? "Acesse o sistema" : "Cadastre-se"}
            </h2>
            <p className="mt-2 text-lg text-slate-500">
              {modo === "login"
                ? "Use o e-mail e a senha da sua conta."
                : "Preencha os dados para criar o primeiro acesso."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {modo === "cadastro" && (
                <label className="block">
                  <span className={rotuloClass}>Nome</span>
                  <input
                    required
                    value={form.nome}
                    onChange={(event) =>
                      setForm((atual) => ({ ...atual, nome: event.target.value }))
                    }
                    className={campoClass}
                    placeholder="Seu nome"
                  />
                </label>
              )}

              <label className="block">
                <span className={rotuloClass}>E-mail</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, email: event.target.value }))
                  }
                  className={campoClass}
                  placeholder="voce@email.com"
                />
              </label>

              <label className="block">
                <span className={rotuloClass}>Senha</span>
                <input
                  required
                  type="password"
                  minLength={modo === "cadastro" ? 6 : undefined}
                  value={form.senha}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, senha: event.target.value }))
                  }
                  className={campoClass}
                  placeholder="••••••••"
                />
              </label>

              {modo === "login" && (
                <Link
                  href="/esqueceu-senha"
                  className="mb-2 block text-right text-base font-medium text-teal-700 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              )}

              {modo === "cadastro" && (
                <label className="block">
                  <span className={rotuloClass}>Confirmar senha</span>
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
                    className={campoClass}
                    placeholder="••••••••"
                  />
                </label>
              )}

              {erro ? (
                <AuthFeedback
                  tipo="erro"
                  titulo="Não foi possível continuar"
                  mensagem={erro}
                />
              ) : null}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-teal-700 px-4 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
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
    </div>
  );
}
