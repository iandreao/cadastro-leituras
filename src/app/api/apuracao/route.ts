import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import {
  carregarApuracaoPeriodo,
  processarApuracao,
} from "@/lib/apuracao";
import { movimentoEstaFechado } from "@/lib/movimento";
import { apuracaoSchema } from "@/lib/validations";

function mensagemErro(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function paramAusente(valor: string | null) {
  if (valor == null) {
    return true;
  }

  const texto = valor.trim();
  return texto === "" || texto === "undefined" || texto === "null";
}

function respostaApuracaoVazia(error?: string) {
  return NextResponse.json({
    movimento: { fechado: false },
    faturas: [],
    despesasPeriodo: [],
    resumo: null,
    ...(error ? { error } : {}),
  });
}

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const condominioId = searchParams.get("condominioId");
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    if (paramAusente(condominioId) || paramAusente(mes) || paramAusente(ano)) {
      return respostaApuracaoVazia();
    }

    const parsed = apuracaoSchema.safeParse({
      condominioId: condominioId?.trim(),
      mes,
      ano,
    });

    if (!parsed.success) {
      return respostaApuracaoVazia(
        parsed.error.issues[0]?.message ?? "Dados inválidos.",
      );
    }

    const resultado = await carregarApuracaoPeriodo(
      parsed.data.condominioId,
      parsed.data.mes,
      parsed.data.ano,
    );
    const corpo = {
      movimento: resultado.movimento ?? { fechado: false },
      faturas: resultado.faturas ?? [],
      despesasPeriodo: resultado.despesasPeriodo ?? [],
      resumo: resultado.resumo ?? null,
      error: "error" in resultado ? resultado.error : undefined,
    };

    if ("status" in resultado && resultado.status === 404) {
      return NextResponse.json(corpo, { status: 404 });
    }

    return NextResponse.json(corpo);
  } catch (error) {
    return Response.json(
      { error: mensagemErro(error, "Não foi possível carregar a apuração do período.") },
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
    const condominioId = body?.condominioId;
    const mes = body?.mes;
    const ano = body?.ano;

    if (paramAusente(String(condominioId ?? "")) || mes == null || ano == null) {
      return respostaApuracaoVazia();
    }

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
        {
          error: resultado.error,
          movimento: { fechado: false },
          faturas: [],
          despesasPeriodo: [],
          resumo: null,
        },
        { status: resultado.status },
      );
    }

    return NextResponse.json({
      movimento: { fechado: false },
      faturas: resultado.faturas ?? [],
      resumo: resultado.resumo ?? null,
      despesasPeriodo: resultado.despesasPeriodo ?? [],
    });
  } catch (error) {
    return Response.json(
      { error: mensagemErro(error, "Não foi possível processar a apuração.") },
      { status: 500 },
    );
  }
}
