import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, type SessionUser } from "@/lib/auth";
import {
  buscarUltimaLeituraAnterior,
  validarLeituraUnidade,
} from "@/lib/leitura-regras";
import { leituraLoteSchema, leituraSchema } from "@/lib/validations";
import {
  consumoGasInconsistente,
  consumoM3,
  mensagemConsumoGasInconsistente,
  mensagemLeituraMenorQueAnterior,
  rotuloUnidade,
  unidadeElegivelPara,
} from "@/lib/leituras";
import {
  respostaSeMovimentoFechado,
  respostaSePeriodoUnidadeFechado,
} from "@/lib/movimento";
import { buscarCondominioDoTenant, viaCondominio } from "@/lib/multi-tenant";

const includeUnidade = {
  unidade: {
    select: {
      id: true,
      numero: true,
      blocoId: true,
      bloco: {
        select: { id: true, nome: true },
      },
      tipoUnidade: {
        select: { id: true, nome: true },
      },
      tipoConsumo: true,
      nomeMorador: true,
      condominioId: true,
      condominio: {
        select: { id: true, nome: true },
      },
    },
  },
} as const;

export async function GET(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");
  const unidadeId = searchParams.get("unidadeId");

  const leituras = await prisma.leitura.findMany({
    where: {
      ...(unidadeId ? { unidadeId } : {}),
      unidade: {
        ...(condominioId ? { condominioId } : {}),
        ...viaCondominio(session),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      unidadeId: true,
      mes: true,
      ano: true,
      valorAgua: true,
      valorGas: true,
    },
  });

  return NextResponse.json(leituras);
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const body = (await request.json()) as { itens?: unknown; tipo?: unknown };

    if (Array.isArray(body.itens) && (body.tipo === "agua" || body.tipo === "gas")) {
      return salvarLote(body, session);
    }

    const parsed = leituraSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const periodoFechado = await respostaSePeriodoUnidadeFechado(
      parsed.data.unidadeId,
      parsed.data.mes,
      parsed.data.ano,
    );

    if (periodoFechado) {
      return periodoFechado;
    }

    const validado = await validarLeituraUnidade({
      ...parsed.data,
      session,
    });

    if (validado.error) {
      return validado.error;
    }

    const existente = await prisma.leitura.findUnique({
      where: {
        unidadeId_mes_ano: {
          unidadeId: parsed.data.unidadeId,
          mes: parsed.data.mes,
          ano: parsed.data.ano,
        },
      },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Já existe leitura para esta unidade nesta referência." },
        { status: 409 },
      );
    }

    const leitura = await prisma.leitura.create({
      data: {
        unidadeId: parsed.data.unidadeId,
        mes: parsed.data.mes,
        ano: parsed.data.ano,
        valorAgua: validado.valorAgua,
        valorGas: validado.valorGas,
      },
      include: includeUnidade,
    });

    return NextResponse.json(leitura, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível incluir a leitura." },
      { status: 500 },
    );
  }
}

async function salvarLote(body: unknown, session: SessionUser) {
  const parsed = leituraLoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { condominioId, mes, ano, tipo, itens } = parsed.data;
  const condominio = await buscarCondominioDoTenant(session, condominioId);

  if (!condominio) {
    return NextResponse.json(
      { error: "Condomínio não encontrado." },
      { status: 404 },
    );
  }

  const periodoFechado = await respostaSeMovimentoFechado(
    condominioId,
    mes,
    ano,
  );

  if (periodoFechado) {
    return periodoFechado;
  }

  const unidades = await prisma.unidade.findMany({
    where: { condominioId, ...viaCondominio(session) },
    include: {
      tipoUnidade: {
        select: { nome: true },
      },
      bloco: {
        select: { nome: true },
      },
    },
  });
  const porId = new Map(unidades.map((unidade) => [unidade.id, unidade]));

  for (const item of itens) {
    const unidade = porId.get(item.unidadeId);

    if (!unidade) {
      return NextResponse.json(
        { error: "Há unidade que não pertence ao condomínio selecionado." },
        { status: 400 },
      );
    }

    if (!unidadeElegivelPara(unidade.tipoConsumo, tipo)) {
      return NextResponse.json(
        {
          error: `A unidade ${unidade.numero} não é elegível para leitura de ${tipo === "agua" ? "água" : "gás"}.`,
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(item.valor) || item.valor < 0) {
      return NextResponse.json(
        { error: `Informe uma leitura válida para a unidade ${unidade.numero}.` },
        { status: 400 },
      );
    }

    const anterior = await buscarUltimaLeituraAnterior({
      unidadeId: item.unidadeId,
      mes,
      ano,
      tipo,
    });
    const valorAnterior =
      tipo === "agua"
        ? (anterior?.valorAgua ?? 0)
        : (anterior?.valorGas ?? 0);

    if (item.valor < valorAnterior) {
      return NextResponse.json(
        {
          error: mensagemLeituraMenorQueAnterior(
            rotuloUnidade(unidade),
            valorAnterior,
            tipo,
          ),
        },
        { status: 400 },
      );
    }

    if (tipo === "gas") {
      const consumo = consumoM3(item.valor, valorAnterior);

      if (consumoGasInconsistente(consumo)) {
        return NextResponse.json(
          {
            error: mensagemConsumoGasInconsistente(
              rotuloUnidade(unidade),
              consumo,
            ),
          },
          { status: 400 },
        );
      }
    }
  }

  for (const item of itens) {
    const existente = await prisma.leitura.findUnique({
      where: {
        unidadeId_mes_ano: {
          unidadeId: item.unidadeId,
          mes,
          ano,
        },
      },
    });

    if (existente) {
      await prisma.leitura.update({
        where: { id: existente.id },
        data:
          tipo === "agua"
            ? { valorAgua: item.valor }
            : { valorGas: item.valor },
      });
    } else {
      await prisma.leitura.create({
        data: {
          unidadeId: item.unidadeId,
          mes,
          ano,
          valorAgua: tipo === "agua" ? item.valor : null,
          valorGas: tipo === "gas" ? item.valor : null,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, salvas: itens.length }, { status: 201 });
}
