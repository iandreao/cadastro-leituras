import { NextResponse } from "next/server";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { garantirBlocoPadrao } from "@/lib/blocos-db";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { condominioSchema } from "@/lib/validations";
import { ehSuperAdmin, escopoTenant, GESTOR_PADRAO_ID } from "@/lib/multi-tenant";

export async function GET(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  const resumo = new URL(request.url).searchParams.get("resumo") === "1";
  const where = escopoTenant(session);

  if (resumo) {
    const condominios = await prisma.condominio.findMany({
      where,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    return NextResponse.json(condominios);
  }

  const condominios = await prisma.condominio.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      unidades: {
        select: {
          _count: {
            select: { leituras: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    condominios.map(({ unidades, ...condominio }) => ({
      ...condominio,
      temLeitura: unidades.some((unidade) => unidade._count.leituras > 0),
    })),
  );
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = condominioSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const gestorId =
      session.gestorId?.trim() || (ehSuperAdmin(session) ? GESTOR_PADRAO_ID : "");

    if (!gestorId) {
      return NextResponse.json(
        { error: "Usuário sem gestor associado." },
        { status: 403 },
      );
    }

    const cnpj = onlyDigits(parsed.data.cnpj);
    const existente = await prisma.condominio.findUnique({ where: { cnpj } });

    if (existente) {
      return NextResponse.json(
        { error: "Este condomínio já está cadastrado." },
        { status: 409 },
      );
    }

    const condominio = await prisma.condominio.create({
      data: {
        cnpj,
        nome: toTitleCase(parsed.data.nome),
        endereco: toTitleCase(parsed.data.endereco),
        email: parsed.data.email.toLowerCase(),
        celular: onlyDigits(parsed.data.celular),
        gestorId,
      },
    });

    await garantirBlocoPadrao(condominio.id);

    invalidarCacheCadastro();
    return NextResponse.json(condominio, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível incluir o condomínio." },
      { status: 500 },
    );
  }
}
