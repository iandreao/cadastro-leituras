import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  exigirAmbienteAuth,
  repositorioUsuario,
  responderErroAuth,
} from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ambiente = exigirAmbienteAuth();

  if (ambiente) {
    return ambiente;
  }

  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { token, senha } = parsed.data;
    const registro = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!registro || registro.expires.getTime() <= Date.now()) {
      if (registro) {
        await prisma.passwordResetToken.delete({ where: { id: registro.id } });
      }

      return NextResponse.json(
        { error: "Link inválido ou expirado. Solicite uma nova recuperação." },
        { status: 400 },
      );
    }

    const email = registro.email.toLowerCase();
    const usuario = await repositorioUsuario().findUnique({
      where: { email },
      select: { id: true },
    });

    if (!usuario) {
      await prisma.passwordResetToken.delete({ where: { id: registro.id } });
      return NextResponse.json(
        { error: "Link inválido ou expirado. Solicite uma nova recuperação." },
        { status: 400 },
      );
    }

    const hash = await bcrypt.hash(senha, 10);

    await repositorioUsuario().update({
      where: { id: usuario.id },
      data: { senha: hash },
    });

    await prisma.passwordResetToken.delete({ where: { id: registro.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return responderErroAuth(error);
  }
}
