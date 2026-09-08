"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthFeedback } from "@/components/AuthFeedback";
import AuthLayout from "@/components/AuthLayout";

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export default function EsqueceuSenhaScreen() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setSucesso("");
    setEnviando(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        error?: string;
        mensagem?: string;
      };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível enviar o link agora.");
        return;
      }

      setSucesso(
        data.mensagem ??
          "Se o e-mail estiver cadastrado, um link de recuperação será enviado",
      );
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold text-slate-900">
        Esqueci minha senha
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Informe o e-mail da conta para receber o link de recuperação.
      </p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            E-mail
          </span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={campoClass}
            placeholder="voce@email.com"
            autoComplete="email"
          />
        </label>

        {sucesso ? (
          <AuthFeedback
            tipo="sucesso"
            titulo="Link enviado!"
            mensagem={sucesso}
          />
        ) : null}
        {erro ? (
          <AuthFeedback tipo="erro" titulo="Não foi possível enviar" mensagem={erro} />
        ) : null}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {enviando ? "Enviando..." : "Enviar link de recuperação"}
        </button>
      </form>

      <p className="mt-3 text-sm text-slate-600">
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}
