import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { blocoCadastroSchema } from "@/lib/validations";
import { buscarCondominioDoTenant, viaCondominio } from "@/lib/multi-tenant";

const includeBloco = {
  _count: {
    select: {
      unidades: true,
      tiposUnidade: true,
      tiposDespesa: true,
      despesasMensais: true,
    },
  },
} as const;

export async function GET(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const condominioId =
      new URL(request.url).searchParams.get("condominioId")?.trim() ?? "";

    if (!condominioId) {
      return NextResponse.json(
        { error: "Selecione o condomínio." },
        { status: 400 },
      );
    }

    const condominio = await buscarCondominioDoTenant(session, condominioId);

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    const blocos = await prisma.bloco.findMany({
      where: { condominioId, ...viaCondominio(session) },
      orderBy: { nome: "asc" },
      include: includeBloco,
    });

    return NextResponse.json(blocos);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível listar os blocos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
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
    const condominioId = String(parsed.data.condominioId).trim();

    if (!nome || !condominioId) {
      return NextResponse.json({ error: "Dados ausentes." }, { status: 400 });
    }

    const condominio = await buscarCondominioDoTenant(session, condominioId);

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    const bloco = await prisma.bloco.create({
      data: {
        nome,
        condominioId,
      },
      include: includeBloco,
    });

    invalidarCacheCadastro();
    return NextResponse.json(bloco, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um bloco/torre com este nome neste condomínio." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível cadastrar o bloco/torre." },
      { status: 500 },
    );
  }
}
