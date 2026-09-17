"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFeedback } from "@/components/AuthFeedback";
import AuthLayout from "@/components/AuthLayout";
import { CAMPO, ROTULO_CAMPO } from "@/lib/ui-form";

const campoClass = CAMPO;

export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setSucesso("");

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
      const response = await fetch("/api/auth/nova-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, confirmarSenha }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível atualizar a senha.");
        return;
      }

      setSucesso("Senha definida. Você já pode usar o sistema.");
      window.setTimeout(() => {
        router.push("/condominios");
        router.refresh();
      }, 800);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-medium text-slate-900">
        Defina sua senha
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Este é o primeiro acesso. Troque a senha inicial para continuar.
      </p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className={ROTULO_CAMPO}>
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
          <span className={ROTULO_CAMPO}>
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
          <AuthFeedback
            tipo="sucesso"
            titulo="Senha atualizada"
            mensagem={sucesso}
          />
        ) : null}
        {erro ? (
          <AuthFeedback
            tipo="erro"
            titulo="Não foi possível continuar"
            mensagem={erro}
          />
        ) : null}

        <button
          type="submit"
          disabled={enviando || Boolean(sucesso)}
          className="h-10 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </AuthLayout>
  );
}
