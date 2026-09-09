import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { includeTipoUnidade } from "@/lib/unidades";
import { unidadeTemVinculoDeExclusao } from "@/lib/unidade-exclusao";
import { registrarMoradorNaUnidade } from "@/lib/historico-morador";
import { unidadeSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

const includeUnidade = {
  condominio: {
    select: { id: true, nome: true },
  },
  ...includeTipoUnidade,
} as const;

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = unidadeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.unidade.findUnique({ where: { id } });

    if (!atual) {
      return NextResponse.json(
        { error: "Unidade não encontrada." },
        { status: 404 },
      );
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: parsed.data.condominioId },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    const tipoUnidade = await prisma.tipoUnidade.findUnique({
      where: { id: parsed.data.tipoUnidadeId },
    });

    if (!tipoUnidade) {
      return NextResponse.json(
        { error: "Tipo de unidade não encontrado." },
        { status: 404 },
      );
    }

    if (tipoUnidade.condominioId !== parsed.data.condominioId) {
      return NextResponse.json(
        { error: "O tipo de unidade não pertence ao condomínio selecionado." },
        { status: 400 },
      );
    }

    const resolvido = await resolverBlocoDoCondominio(
      parsed.data.condominioId,
      parsed.data.blocoId,
    );

    if (resolvido.error) {
      return NextResponse.json({ error: resolvido.error }, { status: 400 });
    }

    const { blocoId } = resolvido;

    if (tipoUnidade.blocoId !== blocoId) {
      return NextResponse.json(
        { error: "O tipo de unidade não pertence ao bloco selecionado." },
        { status: 400 },
      );
    }

    const numero = parsed.data.numero.trim();
    const outra = await prisma.unidade.findUnique({
      where: {
        condominioId_blocoId_numero: {
          condominioId: parsed.data.condominioId,
          blocoId,
          numero,
        },
      },
    });

    if (outra && outra.id !== id) {
      return NextResponse.json(
        { error: "Esta unidade já está cadastrada neste condomínio." },
        { status: 409 },
      );
    }

    const unidade = await prisma.unidade.update({
      where: { id },
      data: {
        numero,
        nomeMorador: toTitleCase(parsed.data.nomeMorador),
        celular: onlyDigits(parsed.data.celular),
        tipoUnidadeId: parsed.data.tipoUnidadeId,
        tipoConsumo: parsed.data.tipoConsumo,
        blocoId,
        condominioId: parsed.data.condominioId,
      },
      include: includeUnidade,
    });

    await registrarMoradorNaUnidade(
      {
        id: atual.id,
        nomeMorador: atual.nomeMorador,
        celular: atual.celular,
        createdAt: atual.createdAt,
      },
      {
        nomeMorador: unidade.nomeMorador,
        celular: unidade.celular,
      },
    );

    invalidarCacheCadastro();
    return NextResponse.json(unidade);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar a unidade." },
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

  const unidade = await prisma.unidade.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!unidade) {
    return NextResponse.json(
      { error: "Unidade não encontrada." },
      { status: 404 },
    );
  }

  if (await unidadeTemVinculoDeExclusao(id)) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: há leitura, consumo ou movimento vinculado a esta unidade.",
      },
      { status: 409 },
    );
  }

  await prisma.unidade.delete({ where: { id } });

  invalidarCacheCadastro();
  return NextResponse.json({ ok: true });
}
