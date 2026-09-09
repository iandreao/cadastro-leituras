import { NextResponse } from "next/server";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { condominioSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = condominioSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const atual = await prisma.condominio.findUnique({ where: { id } });

    if (!atual) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    const cnpj = onlyDigits(parsed.data.cnpj);
    const outro = await prisma.condominio.findUnique({ where: { cnpj } });

    if (outro && outro.id !== id) {
      return NextResponse.json(
        { error: "Este condomínio já está cadastrado." },
        { status: 409 },
      );
    }

    const condominio = await prisma.condominio.update({
      where: { id },
      data: {
        cnpj,
        nome: toTitleCase(parsed.data.nome),
        endereco: toTitleCase(parsed.data.endereco),
        email: parsed.data.email.toLowerCase(),
        celular: onlyDigits(parsed.data.celular),
      },
    });

    invalidarCacheCadastro();
    return NextResponse.json(condominio);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o condomínio." },
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

  const condominio = await prisma.condominio.findUnique({
    where: { id },
    include: {
      unidades: {
        include: {
          _count: { select: { leituras: true, faturas: true } },
        },
      },
    },
  });

  if (!condominio) {
    return NextResponse.json(
      { error: "Condomínio não encontrado." },
      { status: 404 },
    );
  }

  const temLeitura = condominio.unidades.some(
    (unidade) => unidade._count.leituras > 0,
  );
  const temFatura = condominio.unidades.some(
    (unidade) => unidade._count.faturas > 0,
  );

  if (temLeitura) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: há leitura vinculada a unidade deste condomínio.",
      },
      { status: 409 },
    );
  }

  if (temFatura) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: há fatura vinculada a unidade deste condomínio.",
      },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.despesaMensal.deleteMany({ where: { condominioId: id } }),
    prisma.unidade.deleteMany({ where: { condominioId: id } }),
    prisma.tipoUnidade.deleteMany({ where: { condominioId: id } }),
    prisma.tipoDespesa.deleteMany({ where: { condominioId: id } }),
    prisma.bloco.deleteMany({ where: { condominioId: id } }),
    prisma.condominio.delete({ where: { id } }),
  ]);

  invalidarCacheCadastro();
  return NextResponse.json({ ok: true });
}
