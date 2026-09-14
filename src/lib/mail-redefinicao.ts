import { Resend } from "resend";
import { urlBaseApp } from "@/lib/app-url";
import {
  montarHtmlEmailRecuperacao,
  montarTextoEmailRecuperacao,
} from "@/lib/email-recuperacao";

const REMETENTE_PADRAO = "contato@condominiovenetto.com.br";

export async function enviarEmailRedefinicao(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const resend = new Resend(apiKey);
  const destinatario = email.trim().toLowerCase();
  const remetente = process.env.RESEND_FROM?.trim() || REMETENTE_PADRAO;
  const link = `${urlBaseApp()}/redefinir-senha?token=${encodeURIComponent(token)}`;

  const { data, error } = await resend.emails.send({
    from: remetente,
    to: destinatario,
    subject: "Recuperação de senha - Portal do Condomínio",
    html: montarHtmlEmailRecuperacao(link),
    text: montarTextoEmailRecuperacao(link),
  });

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  return data;
}
