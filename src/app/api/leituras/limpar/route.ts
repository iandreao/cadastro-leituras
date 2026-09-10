import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { limparLeituras } from "@/lib/limpar-leituras";

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const resultado = await limparLeituras(session);

  return NextResponse.json({
    ok: true,
    excluidas: resultado.count,
  });
}
