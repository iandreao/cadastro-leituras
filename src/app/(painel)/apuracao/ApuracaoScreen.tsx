"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  dispararWhatsApp,
  linkWhatsAppCobranca,
  montarMensagemCobranca,
} from "@/lib/cobranca-whatsapp";
import { NOME_BLOCO_PADRAO } from "@/lib/blocos";
import { rotuloFormaCobranca } from "@/lib/despesas";
import { MESES, anosReferencia } from "@/lib/leituras";
import { periodoBrasil } from "@/lib/periodo";
import { toTitleCase } from "@/lib/masks";
import { usePublicarCondominio } from "@/lib/condominio-selecionado";
import { useCondominiosResumo } from "@/lib/use-condominios-resumo";

function formatarNumeroMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

function nomeBlocoLinha(bloco: string | { nome: string }) {
  return typeof bloco === "string" ? bloco : bloco.nome;
}

function pastaArquivoCondominio(nome: string) {
  return (
    nome
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Condominio"
  );
}

function nomeArquivoApuracao(nomeCondominio: string, mes: number, ano: number) {
  const mm = String(mes).padStart(2, "0");
  return `${pastaArquivoCondominio(nomeCondominio)}/ApuraçãoDespesas_${mm}${ano}.xlsx`;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function ehLinhaCondominio(item: FaturaUnidade) {
  const bloco = normalizarTexto(nomeBlocoLinha(item.unidade.bloco));
  const tipo = normalizarTexto(item.unidade.tipoUnidade.nome);

  return (
    bloco === normalizarTexto(NOME_BLOCO_PADRAO) ||
    tipo === normalizarTexto("Condomínio")
  );
}

function ValorContabil({
  valor,
  className = "",
}: {
  valor: number;
  className?: string;
}) {
  return (
    <div className={`flex w-24 justify-between font-sans ${className}`.trim()}>
      <span className="font-sans font-normal tabular-nums text-gray-400">R$</span>
      <span className="font-sans font-normal tabular-nums text-slate-800">
        {formatarNumeroMoeda(valor)}
      </span>
    </div>
  );
}

function CelulaMoeda({
  valor,
  className = "w-28 max-w-[120px] px-2 py-1 text-right text-sm font-sans text-slate-800",
}: {
  valor: number;
  className?: string;
}) {
  return (
    <td className={className}>
      <ValorContabil valor={valor} className="ml-auto" />
    </td>
  );
}

type Condominio = {
  id: string;
  nome: string;
};

type FaturaUnidade = {
  id: string;
  mes: number;
  ano: number;
  valorAgua: number;
  valorEnergia: number;
  valorGas: number;
  valorOutras: number;
  valorTotal: number;
  consumoAguaM3?: number;
  consumoGasM3?: number;
  unidade: {
    id: string;
    numero: string;
    bloco: string | { nome: string };
    nomeMorador: string;
    celular: string;
    tipoUnidade: { nome: string };
  };
};

type DespesaPeriodo = {
  nome: string;
  bloco: string;
  formaCobranca: string;
  classificacao: "fixa" | "agua" | "gas";
  valorTotal: number;
};

type RespostaApuracao = {
  error?: string;
  faturas?: FaturaUnidade[];
  despesasPeriodo?: DespesaPeriodo[];
  movimento?: { fechado?: boolean };
};

function lerResposta(data: RespostaApuracao | FaturaUnidade[]) {
  if (Array.isArray(data)) {
    return {
      faturas: data,
      despesasPeriodo: [] as DespesaPeriodo[],
      fechado: false,
    };
  }

  return {
    faturas: data.faturas ?? [],
    despesasPeriodo: data.despesasPeriodo ?? [],
    fechado: Boolean(data.movimento?.fechado),
  };
}

const campoClass =
  "block h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-sans text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const rotuloFiltro = "mb-1 block text-xs font-semibold text-slate-700";

const agoraBrasil = periodoBrasil();

function IndicadorCarregamento({
  texto,
  className = "py-6",
}: {
  texto: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 text-sm text-slate-600 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600"
        aria-hidden="true"
      />
      <span>{texto}</span>
    </div>
  );
}

function ApuracaoFiltros({
  condominioId,
  mes,
  ano,
  condominios,
  movimentoFechado,
  salvandoMovimento,
  isLoading,
  onCondominio,
  onMes,
  onAno,
  onFechar,
  onReabrir,
}: {
  condominioId: string;
  mes: number;
  ano: number;
  condominios: Condominio[];
  movimentoFechado: boolean;
  salvandoMovimento: boolean;
  isLoading: boolean;
  onCondominio: (valor: string) => void;
  onMes: (valor: number) => void;
  onAno: (valor: number) => void;
  onFechar: () => void;
  onReabrir: () => void;
}) {
  const botoesDesabilitados = salvandoMovimento || isLoading;

  return (
    <div className="flex w-full max-w-full flex-col gap-4 lg:flex-row lg:items-end">
      <label htmlFor="apuracao-condominio" className="block w-full min-w-0 lg:flex-1">
        <span className={rotuloFiltro}>Condomínio</span>
        <select
          id="apuracao-condominio"
          required
          value={condominioId}
          onChange={(event) => onCondominio(event.target.value)}
          className={campoClass}
        >
          <option value="">Selecione</option>
          {condominios.map((item) => (
            <option key={item.id} value={item.id}>
              {toTitleCase(item.nome)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid w-full grid-cols-2 gap-3 lg:flex lg:w-auto lg:shrink-0 lg:gap-4">
        <label htmlFor="apuracao-mes" className="block min-w-0 w-full lg:w-48">
          <span className={rotuloFiltro}>Mês</span>
          <select
            id="apuracao-mes"
            required
            value={mes}
            onChange={(event) => onMes(Number(event.target.value))}
            className={campoClass}
          >
            {MESES.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="apuracao-ano" className="block min-w-0 w-full lg:w-32">
          <span className={rotuloFiltro}>Ano</span>
          <select
            id="apuracao-ano"
            required
            value={ano}
            onChange={(event) => onAno(Number(event.target.value))}
            className={campoClass}
          >
            {anosReferencia(agoraBrasil.ano).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {condominioId && (!isLoading || salvandoMovimento) ? (
        movimentoFechado ? (
          <button
            type="button"
            disabled={botoesDesabilitados}
            onClick={onReabrir}
            className="h-10 w-full rounded-lg bg-amber-600 px-4 text-sm font-semibold tracking-wide text-white uppercase shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto lg:shrink-0"
          >
            {salvandoMovimento ? "Reabrindo..." : "Reabrir Movimento"}
          </button>
        ) : (
          <button
            type="button"
            disabled={botoesDesabilitados}
            onClick={onFechar}
            className="h-10 w-full rounded-lg bg-[#0b3b4a] px-4 text-sm font-semibold tracking-wide text-white uppercase shadow-sm hover:bg-[#0e4d61] disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto lg:shrink-0"
          >
            {salvandoMovimento ? "Fechando..." : "Fechar Movimento"}
          </button>
        )
      ) : null}
    </div>
  );
}

export default function ApuracaoScreen({
  condominios: condominiosIniciais = [],
}: {
  condominios?: Condominio[];
}) {
  const condominios = useCondominiosResumo(condominiosIniciais);
  const [condominioId, setCondominioId] = useState("");
  const [mes, setMes] = useState(agoraBrasil.mes);
  const [ano, setAno] = useState(agoraBrasil.ano);
  const [faturas, setFaturas] = useState<FaturaUnidade[]>([]);
  const [despesasPeriodo, setDespesasPeriodo] = useState<DespesaPeriodo[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [movimentoFechado, setMovimentoFechado] = useState(false);
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  useEffect(() => {
    setFaturas([]);
    setDespesasPeriodo([]);
    setMovimentoFechado(false);
    setErro("");
    setInfo("");

    if (!condominioId) {
      setIsLoading(false);
      return;
    }

    let ativo = true;
    setIsLoading(true);

    async function carregarPeriodo() {
      try {
        const response = await fetch(
          `/api/apuracao?condominioId=${condominioId}&mes=${mes}&ano=${ano}`,
        );
        const data = (await response.json()) as RespostaApuracao;

        if (!ativo) {
          return;
        }

        const lido = lerResposta(data);
        setFaturas(lido.faturas);
        setDespesasPeriodo(lido.despesasPeriodo);
        setMovimentoFechado(lido.fechado);

        if (!response.ok || data.error) {
          setErro(
            data.error ?? "Não foi possível carregar a apuração do período.",
          );
        }
      } catch {
        if (ativo) {
          setFaturas([]);
          setDespesasPeriodo([]);
          setMovimentoFechado(false);
          setErro("Falha de conexão ao carregar o período.");
        }
      } finally {
        if (ativo) {
          setIsLoading(false);
        }
      }
    }

    void carregarPeriodo();

    return () => {
      ativo = false;
    };
  }, [condominioId, mes, ano]);

  function alterarFiltroCondominio(valor: string) {
    setFaturas([]);
    setDespesasPeriodo([]);
    setErro("");
    setInfo("");
    setIsLoading(Boolean(valor));
    setCondominioId(valor);
  }

  function alterarFiltroMes(valor: number) {
    setFaturas([]);
    setDespesasPeriodo([]);
    setErro("");
    setInfo("");
    setIsLoading(Boolean(condominioId));
    setMes(valor);
  }

  function alterarFiltroAno(valor: number) {
    setFaturas([]);
    setDespesasPeriodo([]);
    setErro("");
    setInfo("");
    setIsLoading(Boolean(condominioId));
    setAno(valor);
  }

  function validarFiltros() {
    if (!condominioId) {
      setErro("Selecione o condomínio, o mês e o ano antes de continuar.");
      return false;
    }

    return true;
  }

  async function alterarMovimento(fechado: boolean) {
    if (!validarFiltros()) {
      return;
    }

    setErro("");
    setInfo("");
    setSalvandoMovimento(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/movimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId, mes, ano, fechado }),
      });
      const data = (await response.json()) as RespostaApuracao & {
        error?: string;
      };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível atualizar o movimento do mês.");
        return;
      }

      setMovimentoFechado(fechado);

      if (fechado) {
        const lido = lerResposta(data);
        setFaturas(lido.faturas);
        setDespesasPeriodo(lido.despesasPeriodo);
        setInfo("Movimento do mês fechado. O WhatsApp foi liberado.");
      } else {
        setInfo("Movimento reaberto. Leituras e despesas podem ser alteradas.");
        const recarregar = await fetch(
          `/api/apuracao?condominioId=${condominioId}&mes=${mes}&ano=${ano}`,
        );
        const atualizado = (await recarregar.json()) as RespostaApuracao;
        const lido = lerResposta(atualizado);
        setFaturas(lido.faturas);
        setDespesasPeriodo(lido.despesasPeriodo);
        setMovimentoFechado(lido.fechado);

        if (!recarregar.ok || atualizado.error) {
          setErro(
            atualizado.error ?? "Não foi possível recalcular a apuração.",
          );
        }
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvandoMovimento(false);
      setIsLoading(false);
    }
  }

  function enviarWhatsApp(item: FaturaUnidade) {
    if (!movimentoFechado) {
      return;
    }
    const url = linkWhatsAppCobranca(
      item.unidade.celular,
      montarMensagemCobranca({
        nomeMorador: item.unidade.nomeMorador,
        mes: item.mes,
        ano: item.ano,
        taxaMensal: item.valorEnergia,
        valorAgua: item.valorAgua,
        valorGas: item.valorGas,
        valorOutras: item.valorOutras,
        valorTotal: item.valorTotal,
      }),
    );

    if (!url) {
      setErro(
        `A unidade ${item.unidade.tipoUnidade.nome} ${item.unidade.numero} não possui celular cadastrado.`,
      );
      return;
    }

    setErro("");
    dispararWhatsApp(url);
  }

  const faturasVisiveis = faturas.filter((item) => !ehLinhaCondominio(item));

  const totais = faturasVisiveis.reduce(
    (acc, item) => ({
      valorAgua: acc.valorAgua + Number(item.valorAgua),
      valorEnergia: acc.valorEnergia + Number(item.valorEnergia),
      valorGas: acc.valorGas + Number(item.valorGas),
      valorOutras: acc.valorOutras + Number(item.valorOutras),
      valorTotal: acc.valorTotal + Number(item.valorTotal),
    }),
    {
      valorAgua: 0,
      valorEnergia: 0,
      valorGas: 0,
      valorOutras: 0,
      valorTotal: 0,
    },
  );

  const condominioSelecionado =
    condominios.find((item) => item.id === condominioId) ?? null;

  function exportarExcel() {
    if (faturasVisiveis.length === 0) {
      return;
    }

    const linhas = faturasVisiveis.map((item) => ({
      Bloco: nomeBlocoLinha(item.unidade.bloco) || "—",
      Unidade: `${item.unidade.tipoUnidade.nome} ${item.unidade.numero}`.trim(),
      Morador: item.unidade.nomeMorador
        ? toTitleCase(item.unidade.nomeMorador)
        : "—",
      "Txa Mensal": Number(item.valorEnergia),
      "Valor Água": Number(item.valorAgua),
      "Valor Gás": Number(item.valorGas),
      Outros: Number(item.valorOutras),
      "Valor Total": Number(item.valorTotal),
    }));

    linhas.push({
      Bloco: "",
      Unidade: "",
      Morador: "Totais",
      "Txa Mensal": totais.valorEnergia,
      "Valor Água": totais.valorAgua,
      "Valor Gás": totais.valorGas,
      Outros: totais.valorOutras,
      "Valor Total": totais.valorTotal,
    });

    const planilha = XLSX.utils.json_to_sheet(linhas);
    const alcance = XLSX.utils.decode_range(planilha["!ref"] ?? "A1");

    for (let linha = 1; linha <= alcance.e.r; linha += 1) {
      for (let coluna = 3; coluna <= 7; coluna += 1) {
        const celula = planilha[XLSX.utils.encode_cell({ r: linha, c: coluna })];

        if (celula && typeof celula.v === "number") {
          celula.z = "#,##0.00";
        }
      }
    }

    planilha["!cols"] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
    ];

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Apuração");
    XLSX.writeFile(
      livro,
      nomeArquivoApuracao(
        condominioSelecionado?.nome ?? "Condominio",
        mes,
        ano,
      ),
    );
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-x-hidden px-0 font-sans sm:px-2">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <ApuracaoFiltros
          condominioId={condominioId}
          mes={mes}
          ano={ano}
          condominios={condominios}
          movimentoFechado={movimentoFechado}
          salvandoMovimento={salvandoMovimento}
          isLoading={isLoading}
          onCondominio={alterarFiltroCondominio}
          onMes={alterarFiltroMes}
          onAno={alterarFiltroAno}
          onFechar={() => void alterarMovimento(true)}
          onReabrir={() => void alterarMovimento(false)}
        />

          {condominioId && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-sm font-medium text-slate-800">
                Despesas cadastradas no mês
              </p>
              {isLoading ? (
                <IndicadorCarregamento
                  texto="Carregando despesas..."
                  className="mt-1 py-2"
                />
              ) : despesasPeriodo.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">
                  Nenhuma despesa encontrada para este condomínio e referência.
                </p>
              ) : (
                <ul className="mt-1.5 grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-2">
                  {despesasPeriodo.map((item, indice) => (
                    <li
                      key={`${item.nome}-${item.bloco}-${indice}`}
                      className="flex items-baseline justify-between gap-3 text-sm text-slate-700"
                    >
                      <span className="min-w-0 truncate">
                        {item.nome} • {item.bloco} •{" "}
                        {rotuloFormaCobranca(item.formaCobranca)}
                      </span>
                      <ValorContabil
                        valor={item.valorTotal}
                        className="shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {info && (
            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-1.5 text-sm text-teal-800">
              {info}
            </p>
          )}
          {erro && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">
              {erro}
            </p>
          )}
      </section>

      <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-medium text-slate-900">
            Resultado da apuração
          </h3>
          <button
            type="button"
            disabled={isLoading || faturasVisiveis.length === 0}
            onClick={exportarExcel}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 fill-current"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 2.5L17.5 8H14zM8.2 11h1.6l1.1 3.1 1.1-3.1h1.6l-1.9 4.8H10.1zm6.3 0H18v1.1h-2.3v.9H17.6v1.1h-1.6v1.7h-1.5z" />
            </svg>
            Exportar Excel
          </button>
        </div>

        {isLoading ? (
          <IndicadorCarregamento texto="Carregando dados da apuração..." />
        ) : faturasVisiveis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Selecione o condomínio para calcular o boleto de cada unidade.
          </p>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-max min-w-full table-auto border-collapse font-sans text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-sm font-semibold text-slate-700">
                  <th className="w-0 whitespace-nowrap px-2 py-1 text-left">
                    Bloco
                  </th>
                  <th className="w-0 whitespace-nowrap px-2 py-1 text-left">
                    Unidade
                  </th>
                  <th className="w-0 whitespace-nowrap px-2 py-1 text-left">
                    Morador
                  </th>
                  <th className="w-28 max-w-[120px] whitespace-nowrap px-2 py-1 text-right">
                    Txa Mensal
                  </th>
                  <th className="w-28 max-w-[120px] whitespace-nowrap px-2 py-1 text-right">
                    Valor Água
                  </th>
                  <th className="w-28 max-w-[120px] whitespace-nowrap px-2 py-1 text-right">
                    Valor Gás
                  </th>
                  <th className="w-24 max-w-[120px] whitespace-nowrap px-2 py-1 text-right">
                    Outros
                  </th>
                  <th className="w-28 max-w-[120px] whitespace-nowrap px-2 py-1 text-right">
                    Valor Total
                  </th>
                  <th className="w-28 whitespace-nowrap px-2 py-1 text-center">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {faturasVisiveis.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-2 py-1 text-left text-slate-700">
                      {typeof item.unidade.bloco === "string"
                        ? item.unidade.bloco || "—"
                        : item.unidade.bloco.nome}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-left font-medium text-slate-900">
                      {item.unidade.tipoUnidade.nome} {item.unidade.numero}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-left text-slate-700">
                      {item.unidade.nomeMorador
                        ? toTitleCase(item.unidade.nomeMorador)
                        : "—"}
                    </td>
                    <CelulaMoeda valor={item.valorEnergia} />
                    <CelulaMoeda valor={item.valorAgua} />
                    <CelulaMoeda valor={item.valorGas} />
                    <CelulaMoeda valor={item.valorOutras} />
                    <CelulaMoeda
                      valor={item.valorTotal}
                      className="w-28 max-w-[120px] px-2 py-1 text-right text-sm font-medium text-slate-900"
                    />
                    <td className="whitespace-nowrap px-2 py-1 text-center">
                      <button
                        type="button"
                        disabled={!movimentoFechado || isLoading}
                        onClick={() => enviarWhatsApp(item)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 text-sm font-medium whitespace-nowrap text-white hover:bg-[#1ebe5a] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-3.5 w-3.5 fill-current"
                        >
                          <path d="M12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.89-4.43 9.89-9.89C21.94 6.43 17.5 2 12.04 2zm5.77 14.05c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.13.11-1.82-.11-.42-.14-.95-.31-1.64-.6-2.89-1.25-4.77-4.16-4.92-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.74-2.12 1-2.41.24-.27.64-.39.86-.39h.62c.2 0 .47-.04.73.56.27.62.91 2.13.99 2.28.08.16.13.34.02.55-.1.2-.16.33-.31.5-.16.18-.33.4-.47.54-.16.16-.32.33-.14.64.19.31.84 1.38 1.8 2.24 1.24 1.1 2.28 1.44 2.6 1.6.32.16.5.14.69-.08.19-.23.8-.93 1.01-1.25.21-.32.43-.26.72-.16.3.1 1.88.89 2.2 1.05.32.16.53.24.61.37.08.14.08.79-.16 1.47z" />
                        </svg>
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-sm font-medium text-slate-900">
                  <td className="whitespace-nowrap px-2 py-1 text-left" colSpan={3}>
                    Totais
                  </td>
                  <CelulaMoeda valor={totais.valorEnergia} />
                  <CelulaMoeda valor={totais.valorAgua} />
                  <CelulaMoeda valor={totais.valorGas} />
                  <CelulaMoeda valor={totais.valorOutras} />
                  <CelulaMoeda valor={totais.valorTotal} />
                  <td className="px-2 py-1" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
