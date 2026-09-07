import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import {
  listarDespesasPeriodo,
  listarFaturasApuracao,
  processarApuracao,
} from "@/lib/apuracao";
import { apuracaoSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const parsed = apuracaoSchema.safeParse({
    condominioId: searchParams.get("condominioId") ?? "",
    mes: searchParams.get("mes"),
    ano: searchParams.get("ano"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const [faturas, despesasPeriodo] = await Promise.all([
    listarFaturasApuracao(
      parsed.data.condominioId,
      parsed.data.mes,
      parsed.data.ano,
    ),
    listarDespesasPeriodo(
      parsed.data.condominioId,
      parsed.data.mes,
      parsed.data.ano,
    ),
  ]);

  return NextResponse.json({ faturas, despesasPeriodo });
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = apuracaoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const resultado = await processarApuracao(
      parsed.data.condominioId,
      parsed.data.mes,
      parsed.data.ano,
    );

    if ("error" in resultado) {
      return NextResponse.json(
        { error: resultado.error },
        { status: resultado.status },
      );
    }

    return NextResponse.json({
      faturas: resultado.faturas,
      resumo: resultado.resumo,
      despesasPeriodo: resultado.despesasPeriodo,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar a apuração." },
      { status: 500 },
    );
  }
}
