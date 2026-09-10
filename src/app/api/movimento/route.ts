import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { processarApuracao } from "@/lib/apuracao";
import {
  definirMovimentoFechado,
  listarPeriodosFechados,
  movimentoEstaFechado,
  type PeriodoFechado,
} from "@/lib/movimento";
import { apuracaoSchema, movimentoSchema } from "@/lib/validations";
import { buscarCondominioDoTenant } from "@/lib/multi-tenant";

function mensagemErro(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function cabecalhosCors(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function lerCampo(
  body: Record<string, unknown>,
  searchParams: URLSearchParams,
  nome: string,
) {
  const doBody = body[nome];
  if (doBody !== undefined && doBody !== null && String(doBody).trim() !== "") {
    return doBody;
  }

  return searchParams.get(nome);
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: cabecalhosCors(request),
  });
}

export async function GET(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const condominioId = searchParams.get("condominioId")?.trim() ?? "";

    if (!condominioId) {
      return NextResponse.json(
        { error: "Selecione o condomínio.", fechado: false, fechados: [] },
        { status: 200, headers: cabecalhosCors(request) },
      );
    }

    const condominio = await buscarCondominioDoTenant(session, condominioId);

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado.", fechado: false, fechados: [] },
        { status: 404, headers: cabecalhosCors(request) },
      );
    }

    const fechados = await listarPeriodosFechados(condominioId);
    const mes = searchParams.get("mes");
    const ano = searchParams.get("ano");

    if (mes && ano) {
      const parsed = apuracaoSchema.safeParse({ condominioId, mes, ano });

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
          { status: 400, headers: cabecalhosCors(request) },
        );
      }

      return NextResponse.json(
        {
          fechado:
            (await movimentoEstaFechado(
              parsed.data.condominioId,
              parsed.data.mes,
              parsed.data.ano,
            )) ||
            fechados.some(
              (item: PeriodoFechado) =>
                item.mes === parsed.data.mes && item.ano === parsed.data.ano,
            ),
          fechados,
        },
        { headers: cabecalhosCors(request) },
      );
    }

    return NextResponse.json(
      { fechado: false, fechados },
      { headers: cabecalhosCors(request) },
    );
  } catch (error) {
    return Response.json(
      { error: mensagemErro(error, "Não foi possível consultar o movimento.") },
      { status: 500, headers: cabecalhosCors(request) },
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const { searchParams } = new URL(request.url);
    let body: Record<string, unknown> = {};

    try {
      const lido = await request.json();
      if (lido && typeof lido === "object" && !Array.isArray(lido)) {
        body = lido as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    const condominioId = lerCampo(body, searchParams, "condominioId");
    const mes = lerCampo(body, searchParams, "mes");
    const ano = lerCampo(body, searchParams, "ano");
    const fechado = body.fechado;

    console.log("[api/movimento] payload recebido", {
      condominioId,
      mes,
      ano,
      fechado,
    });

    const parsed = movimentoSchema.safeParse({
      condominioId,
      mes,
      ano,
      fechado,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400, headers: cabecalhosCors(request) },
      );
    }

    const condominio = await buscarCondominioDoTenant(
      session,
      parsed.data.condominioId,
    );

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404, headers: cabecalhosCors(request) },
      );
    }

    let faturas: unknown[] = [];
    let resumo = null;
    let despesasPeriodo: unknown[] = [];

    if (parsed.data.fechado) {
      const resultado = await processarApuracao(
        parsed.data.condominioId,
        parsed.data.mes,
        parsed.data.ano,
        { session },
      );

      if ("error" in resultado) {
        return NextResponse.json(
          { error: resultado.error, success: false },
          { status: resultado.status, headers: cabecalhosCors(request) },
        );
      }

      faturas = resultado.faturas ?? [];
      resumo = resultado.resumo ?? null;
      despesasPeriodo = resultado.despesasPeriodo ?? [];
    }

    console.log("[api/movimento] gravando status no Prisma", {
      condominioId: parsed.data.condominioId,
      mes: parsed.data.mes,
      ano: parsed.data.ano,
      fechado: parsed.data.fechado,
    });

    try {
      await definirMovimentoFechado(
        parsed.data.condominioId,
        parsed.data.mes,
        parsed.data.ano,
        parsed.data.fechado,
      );
    } catch (prismaError) {
      console.error("[api/movimento] falha ao gravar movimento", prismaError);
      return Response.json(
        {
          success: false,
          error: mensagemErro(
            prismaError,
            "Não foi possível atualizar o movimento do mês.",
          ),
        },
        { status: 500, headers: cabecalhosCors(request) },
      );
    }

    return Response.json(
      {
        success: true,
        movimento: { fechado: parsed.data.fechado },
        faturas,
        resumo,
        despesasPeriodo,
      },
      { headers: cabecalhosCors(request) },
    );
  } catch (error) {
    console.error("[api/movimento] erro inesperado", error);
    return Response.json(
      {
        success: false,
        error: mensagemErro(
          error,
          "Não foi possível atualizar o movimento do mês.",
        ),
      },
      { status: 500, headers: cabecalhosCors(request) },
    );
  }
}
