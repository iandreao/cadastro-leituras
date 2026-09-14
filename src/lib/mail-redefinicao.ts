import { Resend } from "resend";
import { urlBaseApp } from "@/lib/app-url";
import {
  montarHtmlEmailRecuperacao,
  montarTextoEmailRecuperacao,
} from "@/lib/email-recuperacao";

// Plano gratuito Resend: remetente sandbox até autenticar domínio próprio.
const REMETENTE_SANDBOX = "onboarding@resend.dev";

function textoErro(error: unknown) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message ?? "");
  }

  return String(error);
}

function ehRestricaoSandbox(error: unknown) {
  const mensagem = textoErro(error).toLowerCase();
  return (
    mensagem.includes("testing emails") ||
    mensagem.includes("only send") ||
    mensagem.includes("verify a domain") ||
    mensagem.includes("own email")
  );
}

function emailPermitidoNoErro(error: unknown) {
  const mensagem = textoErro(error);
  const entreParenteses = mensagem.match(/\(([^@\s)]+@[^@\s)]+)\)/);
  if (entreParenteses?.[1]) {
    return entreParenteses[1].trim().toLowerCase();
  }

  const solto = mensagem.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return solto?.[0]?.trim().toLowerCase() ?? "";
}

export async function enviarEmailRedefinicao(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const resend = new Resend(apiKey);
  const destinatario = email.trim().toLowerCase();
  const sandboxTo = process.env.RESEND_SANDBOX_TO?.trim().toLowerCase();
  const link = `${urlBaseApp()}/redefinir-senha?token=${encodeURIComponent(token)}`;

  async function disparar(para: string, contaOriginal?: string) {
    return resend.emails.send({
      from: REMETENTE_SANDBOX,
      to: para,
      subject: contaOriginal
        ? `Recuperação de senha - Portal do Condomínio (${contaOriginal})`
        : "Recuperação de senha - Portal do Condomínio",
      html: montarHtmlEmailRecuperacao(link, contaOriginal),
      text: montarTextoEmailRecuperacao(link, contaOriginal),
    });
  }

  const destinoInicial = sandboxTo || destinatario;
  const { data, error } = await disparar(
    destinoInicial,
    sandboxTo && sandboxTo !== destinatario ? destinatario : undefined,
  );

  if (!error) {
    return data;
  }

  if (ehRestricaoSandbox(error)) {
    const permitido =
      sandboxTo || emailPermitidoNoErro(error);

    if (permitido && permitido !== destinoInicial) {
      const retry = await disparar(permitido, destinatario);

      if (!retry.error) {
        return retry.data;
      }

      console.error(retry.error);
      throw new Error(textoErro(retry.error) || "Falha ao enviar e-mail de teste.");
    }
  }

  console.error(error);
  throw new Error(textoErro(error) || "Falha ao enviar e-mail de recuperação.");
}
