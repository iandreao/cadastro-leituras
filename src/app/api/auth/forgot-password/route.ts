import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  exigirAmbienteAuth,
  repositorioUsuario,
  responderErroAuth,
} from "@/lib/auth-api";
import { enviarEmailRedefinicao } from "@/lib/mail-redefinicao";
import {
  apagarTokenPorValor,
  apagarTokensPorEmail,
  criarTokenRedefinicao,
} from "@/lib/password-reset-token";
import { forgotPasswordSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MENSAGEM_OK =
  "Se o e-mail estiver cadastrado, um link de recuperação será enviado";

export async function POST(request: Request) {
  const ambiente = exigirAmbienteAuth();

  if (ambiente) {
    return ambiente;
  }

  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const usuario = await repositorioUsuario().findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!usuario) {
      return NextResponse.json({ ok: true, mensagem: MENSAGEM_OK });
    }

    await apagarTokensPorEmail(email);

    const token = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await criarTokenRedefinicao(email, token, expires);

    try {
      await enviarEmailRedefinicao(email, token);
    } catch (erroEnvio) {
      await apagarTokenPorValor(token);
      console.error(erroEnvio);
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail de recuperação agora." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, mensagem: MENSAGEM_OK });
  } catch (error) {
    console.error(error);
    return responderErroAuth(error);
  }
}
