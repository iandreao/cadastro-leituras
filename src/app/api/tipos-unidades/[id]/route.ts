import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { tipoUnidadeSchema } from "@/lib/validations";
import { buscarCondominioDoTenant, viaCondominio } from "@/lib/multi-tenant";

type RouteContext = { params: Promise<{ id: string }> };

const includeTipo = {
  bloco: {
    select: { id: true, nome: true },
  },
  _count: {
    select: { unidades: true, regras: true },
  },
} as const;

const MENSAGEM_EXCLUSAO_BLOQUEADA =
  "Não é possível excluir um tipo de unidade se existir uma unidade ou despesa correlacionada";

export async function PUT(request: Request, context: RouteContext) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = tipoUnidadeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.tipoUnidade.findFirst({
      where: { id, ...viaCondominio(session) },
    });

    if (!atual) {
      return NextResponse.json(
        { error: "Tipo de unidade não encontrado." },
        { status: 404 },
      );
    }

    const condominio = await buscarCondominioDoTenant(
      session,
      parsed.data.condominioId,
    );

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (atual.condominioId !== parsed.data.condominioId) {
      return NextResponse.json(
        { error: "Este tipo de unidade não pertence ao condomínio selecionado." },
        { status: 403 },
      );
    }

    const resolvido = await resolverBlocoDoCondominio(
      parsed.data.condominioId,
      parsed.data.blocoId,
    );

    if (resolvido.error) {
      return NextResponse.json({ error: resolvido.error }, { status: 400 });
    }

    const nome = parsed.data.nome.trim();
    const { blocoId } = resolvido;
    const outro = await prisma.tipoUnidade.findFirst({
      where: {
        nome,
        condominioId: parsed.data.condominioId,
        blocoId,
      },
    });

    if (outro && outro.id !== id) {
      return NextResponse.json(
        { error: "Já existe um tipo de unidade com este nome neste condomínio e bloco." },
        { status: 409 },
      );
    }

    const tipo = await prisma.tipoUnidade.update({
      where: { id },
      data: { nome, blocoId },
      include: includeTipo,
    });

    return NextResponse.json(tipo);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o tipo de unidade." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const condominioId = params.get("condominioId")?.trim();
  const blocoId = params.get("blocoId")?.trim();

  const tipo = await prisma.tipoUnidade.findFirst({
    where: { id, ...viaCondominio(session) },
    include: {
      _count: { select: { unidades: true } },
    },
  });

  if (!tipo) {
    return NextResponse.json(
      { error: "Tipo de unidade não encontrado." },
      { status: 404 },
    );
  }

  if (!condominioId || !blocoId || tipo.condominioId !== condominioId || tipo.blocoId !== blocoId) {
    return NextResponse.json(
      { error: "Este tipo de unidade não pertence ao condomínio e bloco selecionados." },
      { status: 403 },
    );
  }

  const despesasCorrelacionadas = await prisma.despesaMensal.count({
    where: {
      condominioId,
      tipoDespesa: {
        regras: {
          some: { tipoUnidadeId: id },
        },
      },
      OR: [
        { valorTotal: { gt: 0 } },
        { valorFixo: { gt: 0 } },
        { valorVariavel: { gt: 0 } },
      ],
    },
  });

  if (tipo._count.unidades > 0 || despesasCorrelacionadas > 0) {
    return NextResponse.json(
      { error: MENSAGEM_EXCLUSAO_BLOQUEADA },
      { status: 409 },
    );
  }

  await prisma.tipoUnidade.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
