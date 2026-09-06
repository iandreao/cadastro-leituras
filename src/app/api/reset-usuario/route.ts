import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL = "iandreao1308@gmail.com";

export async function GET() {
  try {
    const resultado = await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [EMAIL, EMAIL.toLowerCase()],
        },
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: `O e-mail ${EMAIL} foi removido do banco.`,
      removidos: resultado.count,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível remover o usuário do banco." },
      { status: 500 },
    );
  }
}
