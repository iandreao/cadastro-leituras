import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

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
