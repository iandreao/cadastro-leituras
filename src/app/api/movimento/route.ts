import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { processarApuracao } from "@/lib/apuracao";
import {
  definirMovimentoFechado,
  listarPeriodosFechados,
  movimentoEstaFechado,
} from "@/lib/movimento";
import { prisma } from "@/lib/prisma";
import { apuracaoSchema, movimentoSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId") ?? "";

  if (!condominioId) {
    return NextResponse.json(
      { error: "Selecione o condomínio." },
      { status: 400 },
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
        { status: 400 },
      );
    }

    return NextResponse.json({
      fechado: await movimentoEstaFechado(
        parsed.data.condominioId,
        parsed.data.mes,
        parsed.data.ano,
      ),
      fechados,
    });
  }

  return NextResponse.json({ fechado: false, fechados });
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = movimentoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { condominioId, mes, ano, fechado } = parsed.data;

    const condominio = await prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { id: true },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (fechado) {
      const resultado = await processarApuracao(condominioId, mes, ano);

      if ("error" in resultado) {
        return NextResponse.json(
          { error: resultado.error },
          { status: resultado.status },
        );
      }

      await definirMovimentoFechado(condominioId, mes, ano, true);

      return NextResponse.json({
        movimento: { fechado: true },
        faturas: resultado.faturas,
        resumo: resultado.resumo,
        despesasPeriodo: resultado.despesasPeriodo,
      });
    }

    await definirMovimentoFechado(condominioId, mes, ano, false);

    return NextResponse.json({
      movimento: { fechado: false },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar o movimento do mês." },
      { status: 500 },
    );
  }
}
