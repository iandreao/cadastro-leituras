import { NextResponse } from "next/server";
import { invalidarCacheCadastro } from "@/lib/cache-cadastro";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import { garantirBlocoPadrao } from "@/lib/blocos-db";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { condominioSchema } from "@/lib/validations";
import {
  ehSuperAdmin,
  escopoTenant,
  omitirDadosGestor,
  resolverGestorIdDeCadastro,
  viaCondominio,
} from "@/lib/multi-tenant";

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
      select: { id: true, nome: true, chavePix: true },
    });
    return NextResponse.json(condominios);
  }

  const [condominios, unidadesComLeitura] = await Promise.all([
    prisma.condominio.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...(ehSuperAdmin(session)
        ? {
            include: {
              gestor: { select: { id: true, nome: true } },
            },
          }
        : {}),
    }),
    prisma.unidade.findMany({
      where: {
        ...viaCondominio(session),
        leituras: { some: {} },
      },
      distinct: ["condominioId"],
      select: { condominioId: true },
    }),
  ]);
  const comLeitura = new Set(
    unidadesComLeitura.map((item) => item.condominioId),
  );

  return NextResponse.json(
    condominios.map((condominio) => ({
      ...omitirDadosGestor(condominio, session),
      temLeitura: comLeitura.has(condominio.id),
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

    const candidatoGestor = ehSuperAdmin(session)
      ? (body as { gestorId?: unknown }).gestorId
      : undefined;
    const gestorId = await resolverGestorIdDeCadastro(session, candidatoGestor);

    if (!gestorId) {
      return NextResponse.json(
        { error: "Usuário sem gestor associado." },
        { status: 403 },
      );
    }

    const cnpj = onlyDigits(parsed.data.cnpj);
    const chavePix = parsed.data.chavePix?.trim() || null;
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
        chavePix,
        gestorId,
      },
    });

    await garantirBlocoPadrao(condominio.id);

    invalidarCacheCadastro();
    return NextResponse.json(omitirDadosGestor(condominio, session), {
      status: 201,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível incluir o condomínio." },
      { status: 500 },
    );
  }
}
