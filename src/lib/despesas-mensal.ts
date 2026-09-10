import { Prisma } from "@prisma/client";
import { resolverBlocoDoCondominio } from "@/lib/blocos-db";
import { ehAguaPorConsumo } from "@/lib/despesas";
import { falhaSeMovimentoFechado } from "@/lib/movimento";
import { prisma } from "@/lib/prisma";
import { despesaMensalSchema } from "@/lib/validations";
import type { SessionUser } from "@/lib/auth";
import { buscarCondominioDoTenant, viaCondominio } from "@/lib/multi-tenant";

export const includeDespesa = {
  condominio: {
    select: { id: true, nome: true },
  },
  tipoDespesa: {
    select: { id: true, nome: true },
  },
  bloco: {
    select: { id: true, nome: true, condominioId: true },
  },
} as const;

type Falha = { ok: false; error: string; status: number };

export async function listarDespesasMensais(filtros: {
  condominioId?: string | null;
  blocoId?: string | null;
  session: SessionUser;
}) {
  const condominioId = filtros.condominioId?.trim() || undefined;
  const blocoId =
    filtros.blocoId === null || filtros.blocoId === undefined
      ? undefined
      : filtros.blocoId;

  return prisma.despesaMensal.findMany({
    where: {
      ...(condominioId ? { condominioId } : {}),
      ...(blocoId !== undefined ? { blocoId } : {}),
      ...viaCondominio(filtros.session),
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
    include: includeDespesa,
  });
}

export async function persistirDespesaMensal(
  body: unknown,
  id: string | undefined,
  session: SessionUser,
) {
  const parsed = despesaMensalSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      status: 400,
    } satisfies Falha;
  }

  if (id) {
    const existente = await prisma.despesaMensal.findFirst({
      where: {
        id,
        ...viaCondominio(session),
      },
    });

    if (!existente) {
      return {
        ok: false,
        error: "Despesa não encontrada.",
        status: 404,
      } satisfies Falha;
    }

    const bloqueadoAtual = await falhaSeMovimentoFechado(
      session,
      existente.condominioId,
      existente.mes,
      existente.ano,
    );

    if (bloqueadoAtual) {
      return bloqueadoAtual;
    }
  }

  const { condominioId, tipoDespesaId, blocoId, mes, ano, formaCobranca } =
    parsed.data;

  const bloqueadoNovo = await falhaSeMovimentoFechado(
    session,
    condominioId,
    mes,
    ano,
  );

  if (bloqueadoNovo) {
    return bloqueadoNovo;
  }

  const [condominio, tipoDespesa, resolvido] = await Promise.all([
    buscarCondominioDoTenant(session, condominioId),
    prisma.tipoDespesa.findUnique({
      where: { id: tipoDespesaId },
      select: {
        id: true,
        nome: true,
        condominioId: true,
        blocoId: true,
      },
    }),
    resolverBlocoDoCondominio(condominioId, blocoId),
  ]);

  if (!condominio) {
    return {
      ok: false,
      error: "Condomínio não encontrado.",
      status: 404,
    } satisfies Falha;
  }

  if (!tipoDespesa) {
    return {
      ok: false,
      error: "Tipo de despesa não encontrado.",
      status: 404,
    } satisfies Falha;
  }

  if (resolvido.error) {
    return { ok: false, error: resolvido.error, status: 400 } satisfies Falha;
  }

  if (tipoDespesa.condominioId !== condominioId) {
    return {
      ok: false,
      error: "O tipo de despesa não pertence ao condomínio selecionado.",
      status: 400,
    } satisfies Falha;
  }

  if (tipoDespesa.blocoId !== resolvido.blocoId) {
    return {
      ok: false,
      error: "O tipo de despesa não pertence ao bloco selecionado.",
      status: 400,
    } satisfies Falha;
  }

  let valorFixo: number | null = parsed.data.valorFixo;
  let valorVariavel: number | null = parsed.data.valorVariavel;
  let valorTotal = parsed.data.valorTotal ?? 0;

  if (ehAguaPorConsumo(tipoDespesa.nome, formaCobranca)) {
    if (valorFixo == null || valorFixo < 0) {
      return {
        ok: false,
        error: "Informe o valor fixo da água.",
        status: 400,
      } satisfies Falha;
    }

    if (valorVariavel == null || valorVariavel < 0) {
      return {
        ok: false,
        error: "Informe o valor variável da água.",
        status: 400,
      } satisfies Falha;
    }

    valorTotal = valorFixo + valorVariavel;
  } else {
    valorFixo = null;
    valorVariavel = null;
  }

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    return {
      ok: false,
      error: "Informe um valor total maior que zero.",
      status: 400,
    } satisfies Falha;
  }

  const dados = {
    condominioId,
    tipoDespesaId,
    blocoId: resolvido.blocoId,
    mes,
    ano,
    valorTotal,
    valorFixo,
    valorVariavel,
    formaCobranca,
  };

  try {
    const despesa = id
      ? await prisma.despesaMensal.update({
          where: { id },
          data: dados,
          include: includeDespesa,
        })
      : await prisma.despesaMensal.create({
          data: dados,
          include: includeDespesa,
        });

    return { ok: true as const, despesa };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error:
          "Já existe despesa deste tipo para o condomínio, bloco e mês/ano informados.",
        status: 409,
      } satisfies Falha;
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        ok: false,
        error:
          "Os campos de valor fixo/variável ainda não estão disponíveis no banco. Rode npx prisma db push e reinicie o servidor.",
        status: 500,
      } satisfies Falha;
    }

    return {
      ok: false,
      error: id
        ? "Não foi possível atualizar a despesa."
        : "Não foi possível cadastrar a despesa.",
      status: 500,
    } satisfies Falha;
  }
}
