import { NextResponse } from "next/server";
import { persistirDespesaMensal } from "@/lib/despesas-mensal";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const resultado = await persistirDespesaMensal(body, id);

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error },
        { status: resultado.status },
      );
    }

    return NextResponse.json(resultado.despesa);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar a despesa." },
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

  const despesa = await prisma.despesaMensal.findUnique({
    where: { id },
  });

  if (!despesa) {
    return NextResponse.json(
      { error: "Despesa não encontrada." },
      { status: 404 },
    );
  }

  await prisma.despesaMensal.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
