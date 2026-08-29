import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { limparLeituras } from "@/lib/limpar-leituras";

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const resultado = await limparLeituras();

  return NextResponse.json({
    ok: true,
    excluidas: resultado.count,
  });
}
