import { NextResponse } from "next/server";
import {
  criarBloco,
  listarBlocosPorCondominio,
  nomeBlocoDuplicado,
} from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { blocoCadastroSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const condominioId = new URL(request.url).searchParams.get("condominioId")?.trim();

  if (!condominioId) {
    return NextResponse.json(
      { error: "Selecione o condomínio." },
      { status: 400 },
    );
  }

  const blocos = await listarBlocosPorCondominio(condominioId);

  return NextResponse.json(blocos);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = blocoCadastroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const nome = parsed.data.nome.trim();
    const { condominioId } = parsed.data;

    const condominio = await prisma.condominio.findUnique({
      where: { id: condominioId },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    if (await nomeBlocoDuplicado(condominioId, nome)) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    const bloco = await criarBloco(condominioId, nome);

    return NextResponse.json(bloco, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar o bloco/torre." },
      { status: 500 },
    );
  }
}
