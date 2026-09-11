import { Resend } from "resend";
import { urlBaseApp } from "@/lib/app-url";
import {
  montarHtmlEmailRecuperacao,
  montarTextoEmailRecuperacao,
} from "@/lib/email-recuperacao";

// Plano gratuito Resend: remetente sandbox até autenticar domínio próprio.
const REMETENTE_SANDBOX = "onboarding@resend.dev";

export async function enviarEmailRedefinicao(email: string, token: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const destinatario = email.trim().toLowerCase();
  const link = `${urlBaseApp()}/redefinir-senha?token=${encodeURIComponent(token)}`;

  const { data, error } = await resend.emails.send({
    from: REMETENTE_SANDBOX,
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
