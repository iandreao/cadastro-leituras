import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumoGasInconsistente,
  consumoM3,
  indiceReferencia,
  mensagemConsumoGasInconsistente,
  mensagemLeituraMenorQueAnterior,
  nomeMes,
  rotuloUnidade,
  usaAgua,
  usaGas,
} from "@/lib/leituras";

export async function buscarUltimaLeituraAnterior(input: {
  unidadeId: string;
  mes: number;
  ano: number;
  tipo?: "agua" | "gas";
  ignorarId?: string;
}) {
  return prisma.leitura.findFirst({
    where: {
      unidadeId: input.unidadeId,
      ...(input.ignorarId ? { id: { not: input.ignorarId } } : {}),
      OR: [
        { ano: { lt: input.ano } },
        { AND: [{ ano: input.ano }, { mes: { lt: input.mes } }] },
      ],
      ...(input.tipo === "agua"
        ? { valorAgua: { not: null } }
        : input.tipo === "gas"
          ? { valorGas: { not: null } }
          : {}),
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
  });
}

function valorValido(valor: number | null | undefined) {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

export async function validarLeituraUnidade(input: {
  unidadeId: string;
  mes: number;
  ano: number;
  valorAgua?: number | null;
  valorGas?: number | null;
  ignorarId?: string;
}) {
  const unidade = await prisma.unidade.findUnique({
    where: { id: input.unidadeId },
    include: {
      tipoUnidade: {
        select: { nome: true },
      },
      bloco: {
        select: { nome: true },
      },
    },
  });

  if (!unidade) {
    return {
      error: NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 }),
    };
  }

  if (unidade.tipoConsumo === "Nenhum") {
    return {
      error: NextResponse.json(
        { error: "Esta unidade não possui consumo elegível para leitura." },
        { status: 400 },
      ),
    };
  }

  const precisaAgua = usaAgua(unidade.tipoConsumo);
  const precisaGas = usaGas(unidade.tipoConsumo);
  const valorAgua = precisaAgua ? input.valorAgua : null;
  const valorGas = precisaGas ? input.valorGas : null;

  if (precisaAgua && !valorValido(valorAgua)) {
    return {
      error: NextResponse.json(
        { error: "Informe a leitura de água." },
        { status: 400 },
      ),
    };
  }

  if (precisaGas && !valorValido(valorGas)) {
    return {
      error: NextResponse.json(
        { error: "Informe a leitura de gás." },
        { status: 400 },
      ),
    };
  }

  const anterior = await buscarUltimaLeituraAnterior({
    unidadeId: input.unidadeId,
    mes: input.mes,
    ano: input.ano,
    ignorarId: input.ignorarId,
  });

  if (anterior) {
    const atualIndice = indiceReferencia(input.ano, input.mes);
    const anteriorIndice = indiceReferencia(anterior.ano, anterior.mes);

    if (atualIndice !== anteriorIndice + 1) {
      return {
        error: NextResponse.json(
          {
            error: `A referência deve ser o mês seguinte à última leitura (${nomeMes(anterior.mes)}/${anterior.ano}). Não é permitido pular períodos.`,
          },
          { status: 400 },
        ),
      };
    }
  }

  const rotulo = rotuloUnidade(unidade);

  if (precisaAgua && valorAgua != null) {
    const anteriorAgua = await buscarUltimaLeituraAnterior({
      unidadeId: input.unidadeId,
      mes: input.mes,
      ano: input.ano,
      tipo: "agua",
      ignorarId: input.ignorarId,
    });
    const valorAnteriorAgua = anteriorAgua?.valorAgua;

    if (valorAnteriorAgua != null && valorAgua < valorAnteriorAgua) {
      return {
        error: NextResponse.json(
          {
            error: mensagemLeituraMenorQueAnterior(
              rotulo,
              valorAnteriorAgua,
              "agua",
            ),
          },
          { status: 400 },
        ),
      };
    }
  }

  if (precisaGas && valorGas != null) {
    const anteriorGasRegistro = await buscarUltimaLeituraAnterior({
      unidadeId: input.unidadeId,
      mes: input.mes,
      ano: input.ano,
      tipo: "gas",
      ignorarId: input.ignorarId,
    });
    const valorAnteriorGas = anteriorGasRegistro?.valorGas ?? 0;

    if (
      anteriorGasRegistro?.valorGas != null &&
      valorGas < anteriorGasRegistro.valorGas
    ) {
      return {
        error: NextResponse.json(
          {
            error: mensagemLeituraMenorQueAnterior(
              rotulo,
              anteriorGasRegistro.valorGas,
              "gas",
            ),
          },
          { status: 400 },
        ),
      };
    }

    const consumo = consumoM3(valorGas, valorAnteriorGas);

    if (consumoGasInconsistente(consumo)) {
      return {
        error: NextResponse.json(
          {
            error: mensagemConsumoGasInconsistente(rotulo, consumo),
          },
          { status: 400 },
        ),
      };
    }
  }

  return {
    unidade,
    valorAgua: valorAgua ?? null,
    valorGas: valorGas ?? null,
    error: null,
  };
}
