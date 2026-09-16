import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, type SessionUser } from "@/lib/auth";
import { validarLeituraUnidade } from "@/lib/leitura-regras";
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
import { periodoAnterior } from "@/lib/periodo";

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
  const mes = Number(searchParams.get("mes"));
  const ano = Number(searchParams.get("ano"));
  const periodoValido =
    Number.isInteger(mes) &&
    mes >= 1 &&
    mes <= 12 &&
    Number.isInteger(ano) &&
    ano >= 2000;
  const anterior = periodoValido ? periodoAnterior(mes, ano) : null;

  const leituras = await prisma.leitura.findMany({
    where: {
      ...(unidadeId ? { unidadeId } : {}),
      unidade: {
        ...(condominioId ? { condominioId } : {}),
        ...viaCondominio(session),
      },
      ...(anterior
        ? {
            OR: [
              { mes, ano },
              { mes: anterior.mes, ano: anterior.ano },
            ],
          }
        : {}),
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
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
      session,
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
    session,
    condominioId,
    mes,
    ano,
  );

  if (periodoFechado) {
    return periodoFechado;
  }

  const unidades = await prisma.unidade.findMany({
    where: { condominioId, ...viaCondominio(session) },
    select: {
      id: true,
      numero: true,
      tipoConsumo: true,
      tipoUnidade: {
        select: { nome: true },
      },
      bloco: {
        select: { nome: true },
      },
    },
  });
  const porId = new Map(unidades.map((unidade) => [unidade.id, unidade]));
  const unidadeIds = itens.map((item) => item.unidadeId);

  const [existentes, anteriores] = await Promise.all([
    prisma.leitura.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        mes,
        ano,
      },
    }),
    prisma.leitura.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        OR: [
          { ano: { lt: ano } },
          { AND: [{ ano }, { mes: { lt: mes } }] },
        ],
      },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
      select: {
        unidadeId: true,
        valorAgua: true,
        valorGas: true,
      },
    }),
  ]);
  const existentePorUnidade = new Map(
    existentes.map((item) => [item.unidadeId, item]),
  );

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

    const anterior = anteriores.find((leitura) => {
      if (leitura.unidadeId !== item.unidadeId) {
        return false;
      }

      return tipo === "agua"
        ? leitura.valorAgua != null
        : leitura.valorGas != null;
    });
    const valorAnterior =
      tipo === "agua" ? (anterior?.valorAgua ?? 0) : (anterior?.valorGas ?? 0);

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

  const criar = [];
  const atualizar = [];

  for (const item of itens) {
    const existente = existentePorUnidade.get(item.unidadeId);

    if (existente) {
      atualizar.push(
        prisma.leitura.update({
          where: { id: existente.id },
          data:
            tipo === "agua"
              ? { valorAgua: item.valor }
              : { valorGas: item.valor },
        }),
      );
    } else {
      criar.push({
        unidadeId: item.unidadeId,
        mes,
        ano,
        valorAgua: tipo === "agua" ? item.valor : null,
        valorGas: tipo === "gas" ? item.valor : null,
      });
    }
  }

  await prisma.$transaction([
    ...atualizar,
    ...(criar.length > 0 ? [prisma.leitura.createMany({ data: criar })] : []),
  ]);

  return NextResponse.json({ ok: true, salvas: itens.length }, { status: 201 });
}
