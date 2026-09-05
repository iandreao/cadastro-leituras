import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumoGasInconsistente,
  consumoM3,
  indiceReferencia,
  mensagemConsumoGasInconsistente,
  nomeMes,
  rotuloUnidade,
  usaAgua,
  usaGas,
} from "@/lib/leituras";

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

  const anterior = await prisma.leitura.findFirst({
    where: {
      unidadeId: input.unidadeId,
      ...(input.ignorarId ? { id: { not: input.ignorarId } } : {}),
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
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

    if (
      precisaAgua &&
      anterior.valorAgua != null &&
      valorAgua != null &&
      valorAgua < anterior.valorAgua
    ) {
      return {
        error: NextResponse.json(
          {
            error: `A leitura de água não pode ser menor que a última registrada (${anterior.valorAgua}).`,
          },
          { status: 400 },
        ),
      };
    }

    if (
      precisaGas &&
      anterior.valorGas != null &&
      valorGas != null &&
      valorGas < anterior.valorGas
    ) {
      return {
        error: NextResponse.json(
          {
            error: `A leitura de gás não pode ser menor que a última registrada (${anterior.valorGas}).`,
          },
          { status: 400 },
        ),
      };
    }
  }

  if (precisaGas && valorGas != null) {
    const anteriorGas = anterior?.valorGas ?? 0;
    const consumo = consumoM3(valorGas, anteriorGas);

    if (consumoGasInconsistente(consumo)) {
      return {
        error: NextResponse.json(
          {
            error: mensagemConsumoGasInconsistente(
              rotuloUnidade(unidade),
              consumo,
            ),
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
