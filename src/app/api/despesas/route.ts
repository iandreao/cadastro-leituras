import { NextResponse } from "next/server";
import {
  listarDespesasMensais,
  persistirDespesaMensal,
} from "@/lib/despesas-mensal";
import { requireApiSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");
  const blocoId = searchParams.has("blocoId")
    ? searchParams.get("blocoId")
    : null;

  const despesas = await listarDespesasMensais({
    condominioId,
    blocoId,
    session,
  });

  return NextResponse.json(despesas);
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const body = await request.json();
    const resultado = await persistirDespesaMensal(body, undefined, session);

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error },
        { status: resultado.status },
      );
    }

    return NextResponse.json(resultado.despesa, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar a despesa." },
      { status: 500 },
    );
  }
}
