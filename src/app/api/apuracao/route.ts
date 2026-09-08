import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import {
  carregarApuracaoPeriodo,
  processarApuracao,
} from "@/lib/apuracao";
import { movimentoEstaFechado } from "@/lib/movimento";
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

  try {
    const resultado = await carregarApuracaoPeriodo(
      parsed.data.condominioId,
      parsed.data.mes,
      parsed.data.ano,
    );

    if ("status" in resultado && resultado.status === 404) {
      return NextResponse.json(
        {
          error: resultado.error,
          movimento: resultado.movimento,
          faturas: resultado.faturas,
          despesasPeriodo: resultado.despesasPeriodo,
          resumo: resultado.resumo,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      movimento: resultado.movimento,
      faturas: resultado.faturas,
      despesasPeriodo: resultado.despesasPeriodo,
      resumo: resultado.resumo,
      error: "error" in resultado ? resultado.error : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar a apuração do período." },
      { status: 500 },
    );
  }
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

    if (
      await movimentoEstaFechado(
        parsed.data.condominioId,
        parsed.data.mes,
        parsed.data.ano,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "O movimento deste mês está fechado. Reabra o movimento para recalcular a apuração.",
        },
        { status: 409 },
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
      movimento: { fechado: false },
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
