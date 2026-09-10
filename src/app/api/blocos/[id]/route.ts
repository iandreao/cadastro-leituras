import { NextResponse } from "next/server";
import { nomeBlocoDuplicado } from "@/lib/blocos-db";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { blocoCadastroSchema } from "@/lib/validations";
import { buscarCondominioDoTenant, viaCondominio } from "@/lib/multi-tenant";

type RouteContext = { params: Promise<{ id: string }> };

const includeContagens = {
  _count: {
    select: {
      unidades: true,
      tiposUnidade: true,
      tiposDespesa: true,
      despesasMensais: true,
    },
  },
} as const;

export async function PUT(request: Request, context: RouteContext) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = blocoCadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.bloco.findFirst({
      where: { id, ...viaCondominio(session) },
    });

    if (!atual) {
      return NextResponse.json(
        { error: "Bloco/torre não encontrado." },
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
        { error: "Este bloco/torre não pertence ao condomínio selecionado." },
        { status: 403 },
      );
    }

    const nome = parsed.data.nome.trim();

    if (await nomeBlocoDuplicado(parsed.data.condominioId, nome, id)) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    const bloco = await prisma.bloco.update({
      where: { id },
      data: { nome },
      include: includeContagens,
    });

    invalidarCacheCadastro();
    return NextResponse.json(bloco);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o bloco/torre." },
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
  const condominioId = new URL(request.url).searchParams.get("condominioId")?.trim();

  const bloco = await prisma.bloco.findFirst({
    where: { id, ...viaCondominio(session) },
    include: includeContagens,
  });

  if (!bloco) {
    return NextResponse.json(
      { error: "Bloco/torre não encontrado." },
      { status: 404 },
    );
  }

  if (!condominioId || bloco.condominioId !== condominioId) {
    return NextResponse.json(
      { error: "Este bloco/torre não pertence ao condomínio selecionado." },
      { status: 403 },
    );
  }

  const emUso =
    bloco._count.unidades +
      bloco._count.tiposUnidade +
      bloco._count.tiposDespesa +
      bloco._count.despesasMensais >
    0;

  if (emUso) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: há unidades, tipos ou despesas vinculadas a este bloco.",
      },
      { status: 409 },
    );
  }

  await prisma.bloco.delete({ where: { id } });

  invalidarCacheCadastro();
  return NextResponse.json({ ok: true });
}
