import { NextResponse } from "next/server";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth";
import {
  criarTipoDespesa,
  includeTipoDespesaConfig,
  listarTiposDespesaPorBloco,
  substituirRegrasParticipacao,
} from "@/lib/regras-participacao";
import { tipoDespesaConfigSchema } from "@/lib/validations";

async function removerUnicoAntigoPorNomeECondominio() {
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoDespesa_nome_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "TipoDespesa_nome_condominioId_key"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TipoDespesa" DROP CONSTRAINT IF EXISTS "TipoDespesa_nome_key"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TipoDespesa" DROP CONSTRAINT IF EXISTS "TipoDespesa_nome_condominioId_key"`,
  );
}

export async function GET(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const params = new URL(request.url).searchParams;
  const condominioId = params.get("condominioId")?.trim();

  if (!condominioId) {
    return NextResponse.json(
      { error: "Selecione o condomínio." },
      { status: 400 },
    );
  }

  const blocoId = params.get("blocoId")?.trim();

  if (!blocoId) {
    return NextResponse.json(
      { error: "Selecione o bloco/torre." },
      { status: 400 },
    );
  }

  const tipos = await listarTiposDespesaPorBloco(condominioId, blocoId);

  return NextResponse.json(tipos);
}

export async function POST(request: Request) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = tipoDespesaConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const data = {
      nome: parsed.data.nome.trim(),
      condominioId: parsed.data.condominioId,
      blocoId: parsed.data.blocoId.trim(),
    };

    const resolvido = await resolverBlocoDoCondominio(
      data.condominioId,
      data.blocoId,
    );

    if (resolvido.error) {
      return NextResponse.json({ error: resolvido.error }, { status: 400 });
    }

    const condominio = await prisma.condominio.findUnique({
      where: { id: data.condominioId },
    });

    if (!condominio) {
      return NextResponse.json(
        { error: "Condomínio não encontrado." },
        { status: 404 },
      );
    }

    await removerUnicoAntigoPorNomeECondominio();

    const existente = await prisma.tipoDespesa.findFirst({
      where: {
        nome: data.nome,
        condominioId: data.condominioId,
        blocoId: resolvido.blocoId,
      },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Já existe um tipo de despesa com este nome neste condomínio e bloco." },
        { status: 409 },
      );
    }

    const tipo = await criarTipoDespesa({
      nome: data.nome,
      condominioId: data.condominioId,
      blocoId: resolvido.blocoId,
    });

    const regras = await substituirRegrasParticipacao(
      tipo.id,
      parsed.data.tipoUnidadeIds,
      data.condominioId,
      resolvido.blocoId,
    );

    if (regras.error) {
      await prisma.tipoDespesa.delete({ where: { id: tipo.id } });
      return NextResponse.json({ error: regras.error }, { status: 400 });
    }

    const completo = await prisma.tipoDespesa.findUnique({
      where: { id: tipo.id },
      include: includeTipoDespesaConfig,
    });

    return NextResponse.json(completo, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar o tipo de despesa." },
      { status: 500 },
    );
  }
}
