"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFeedback } from "@/components/AuthFeedback";
import AuthLayout from "@/components/AuthLayout";

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState(
    token ? "" : "Link de redefinição inválido. Solicite um novo e-mail.",
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    if (!token) {
      setErro("Link de redefinição inválido. Solicite um novo e-mail.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha, confirmarSenha }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível atualizar a senha.");
        return;
      }

      setSucesso("Sua senha foi atualizada. Você já pode entrar no sistema.");
      window.setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold text-slate-900">Nova senha</h2>
      <p className="mt-1 text-sm text-slate-500">
        Defina uma senha com pelo menos 6 caracteres.
      </p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Nova senha
          </span>
          <input
            required
            type="password"
            minLength={6}
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            className={campoClass}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Confirme a nova senha
          </span>
          <input
            required
            type="password"
            minLength={6}
            value={confirmarSenha}
            onChange={(event) => setConfirmarSenha(event.target.value)}
            className={campoClass}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>

        {sucesso ? (
          <AuthFeedback tipo="sucesso" titulo="Senha atualizada!" mensagem={sucesso} />
        ) : null}
        {erro ? (
          <AuthFeedback tipo="erro" titulo="Não foi possível atualizar" mensagem={erro} />
        ) : null}

        <button
          type="submit"
          disabled={enviando || !token || Boolean(sucesso)}
          className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {enviando ? "Atualizando..." : "Atualizar senha"}
        </button>
      </form>

      <p className="mt-3 text-sm text-slate-600">
        <Link href="/esqueceu-senha" className="font-medium text-teal-700 hover:underline">
          Solicitar um novo link
        </Link>
        {" · "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <p className="text-sm text-slate-500">Carregando...</p>
        </AuthLayout>
      }
    >
      <RedefinirSenhaForm />
    </Suspense>
  );
}
