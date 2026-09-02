import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import {
  includeTipoDespesaConfig,
  substituirRegrasParticipacao,
} from "@/lib/regras-participacao";
import { tipoDespesaConfigSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = tipoDespesaConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.tipoDespesa.findUnique({ where: { id } });

    if (!atual) {
      return NextResponse.json(
        { error: "Tipo de despesa não encontrado." },
        { status: 404 },
      );
    }

    if (atual.condominioId !== parsed.data.condominioId) {
      return NextResponse.json(
        { error: "Este tipo de despesa não pertence ao condomínio selecionado." },
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
    const outro = await prisma.tipoDespesa.findFirst({
      where: {
        nome,
        condominioId: parsed.data.condominioId,
        blocoId,
      },
    });

    if (outro && outro.id !== id) {
      return NextResponse.json(
        { error: "Já existe um tipo de despesa com este nome neste condomínio e bloco." },
        { status: 409 },
      );
    }

    await prisma.tipoDespesa.update({
      where: { id },
      data: { nome, blocoId },
    });

    const regras = await substituirRegrasParticipacao(
      id,
      parsed.data.tipoUnidadeIds,
      parsed.data.condominioId,
      blocoId,
    );

    if (regras.error) {
      return NextResponse.json({ error: regras.error }, { status: 400 });
    }

    const completo = await prisma.tipoDespesa.findUnique({
      where: { id },
      include: includeTipoDespesaConfig,
    });

    return NextResponse.json(completo);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o tipo de despesa." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const condominioId = params.get("condominioId")?.trim();
  const blocoId = params.get("blocoId")?.trim();

  const tipo = await prisma.tipoDespesa.findUnique({
    where: { id },
    include: {
      _count: { select: { despesas: true } },
    },
  });

  if (!tipo) {
    return NextResponse.json(
      { error: "Tipo de despesa não encontrado." },
      { status: 404 },
    );
  }

  if (!condominioId || !blocoId || tipo.condominioId !== condominioId || tipo.blocoId !== blocoId) {
    return NextResponse.json(
      { error: "Este tipo de despesa não pertence ao condomínio e bloco selecionados." },
      { status: 403 },
    );
  }

  if (tipo._count.despesas > 0) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: há despesas lançadas com este tipo.",
      },
      { status: 409 },
    );
  }

  await prisma.tipoDespesa.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
