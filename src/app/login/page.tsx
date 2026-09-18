"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFeedback } from "@/components/AuthFeedback";
import { CAMPO, ROTULO_CAMPO } from "@/lib/ui-form";

const campoClass = CAMPO;
const rotuloClass = ROTULO_CAMPO;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = (await response.json()) as {
        error?: string;
        usuario?: { primeiroAcesso?: boolean };
      };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível continuar.");
        return;
      }

      router.push(data.usuario?.primeiroAcesso ? "/nova-senha" : "/condominios");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden font-sans">
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

            <h2 className="text-3xl font-bold text-slate-900">
              Acesse o sistema
            </h2>
            <p className="mt-2 text-lg text-slate-500">
              Use o e-mail e a senha da sua conta.
            </p>

            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <label className="block">
                <span className={rotuloClass}>E-mail</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={campoClass}
                  placeholder="voce@email.com"
                />
              </label>

              <label className="block">
                <span className={rotuloClass}>Senha</span>
                <input
                  required
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className={campoClass}
                  placeholder="••••••••"
                />
              </label>

              <Link
                href="/esqueceu-senha"
                className="mb-2 block text-right text-base font-medium text-teal-700 hover:underline"
              >
                Esqueceu a senha?
              </Link>

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
                {enviando ? "Aguarde..." : "Entrar"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
