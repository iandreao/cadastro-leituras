"use client";

import { FormEvent, useState } from "react";
import {
  dispararWhatsApp,
  linkWhatsAppCobranca,
  montarMensagemCobranca,
} from "@/lib/cobranca-whatsapp";
import { NOME_BLOCO_PADRAO } from "@/lib/blocos";
import { MESES, anosReferencia } from "@/lib/leituras";
import { toTitleCase } from "@/lib/masks";
import { usePublicarCondominio } from "@/lib/condominio-selecionado";

function formatarNumeroMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

function nomeBlocoLinha(bloco: string | { nome: string }) {
  return typeof bloco === "string" ? bloco : bloco.nome;
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

function CelulaMoeda({
  valor,
  className = "min-w-[120px] px-4 py-1.5 text-sm text-slate-800",
}: {
  valor: number;
  className?: string;
}) {
  return (
    <td className={className}>
      <div className="flex w-full justify-between font-mono">
        <span>R$</span>
        <span>{formatarNumeroMoeda(valor)}</span>
      </div>
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
  unidade: {
    id: string;
    numero: string;
    bloco: string | { nome: string };
    nomeMorador: string;
    celular: string;
    tipoUnidade: { nome: string };
  };
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const agora = new Date();

export default function ApuracaoScreen({
  condominios,
}: {
  condominios: Condominio[];
}) {
  const [condominioId, setCondominioId] = useState("");
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [faturas, setFaturas] = useState<FaturaUnidade[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [processando, setProcessando] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");
    setProcessando(true);

    try {
      const response = await fetch("/api/apuracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId, mes, ano }),
      });
      const data = (await response.json()) as FaturaUnidade[] & { error?: string };

      if (!response.ok) {
        setFaturas([]);
        setErro(data.error ?? "Não foi possível processar a apuração.");
        return;
      }

      setFaturas(data);
      setInfo(
        data.length === 0
          ? "Nenhuma unidade encontrada para o período."
          : `Apuração processada para ${data.length} unidade(s).`,
      );
    } catch {
      setFaturas([]);
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  function enviarWhatsApp(item: FaturaUnidade) {
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

  return (
    <div className="w-full space-y-4 px-2">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-2xl font-medium text-slate-900">
          Apuração de Despesas
        </h2>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="flex flex-row items-end gap-4">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Condomínio
              </span>
              <select
                required
                value={condominioId}
                onChange={(event) => setCondominioId(event.target.value)}
                className={campoClass}
              >
                <option value="">Selecione</option>
                {condominios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="block w-48 shrink-0">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Mês
              </span>
              <select
                required
                value={mes}
                onChange={(event) => setMes(Number(event.target.value))}
                className={campoClass}
              >
                {MESES.map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="block w-32 shrink-0">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Ano
              </span>
              <select
                required
                value={ano}
                onChange={(event) => setAno(Number(event.target.value))}
                className={campoClass}
              >
                {anosReferencia().map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={processando}
            className="w-full rounded-xl bg-blue-600 px-16 py-2.5 text-lg font-semibold tracking-wide text-white uppercase hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {processando ? "Processando..." : "Processar Apuração do Mês"}
          </button>

          {info && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
              {info}
            </p>
          )}
          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
        </form>
      </section>

      <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xl font-medium text-slate-900">
          Resultado da apuração
        </h3>

        {faturasVisiveis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Processe um mês para exibir os valores por unidade.
          </p>
        ) : (
          <div className="w-full max-h-[calc(100vh-14rem)] overflow-auto">
            <table className="w-full table-auto border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="w-0 whitespace-nowrap px-3 py-1.5 text-left font-medium">
                    Bloco
                  </th>
                  <th className="w-0 whitespace-nowrap px-3 py-1.5 text-left font-medium">
                    Unidade
                  </th>
                  <th className="w-0 whitespace-nowrap px-3 py-1.5 text-left font-medium">
                    Morador
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-1.5 text-right font-medium">
                    Txa Mensal
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-1.5 text-right font-medium">
                    Valor Água
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-1.5 text-right font-medium">
                    Valor Gás
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-1.5 text-right font-medium">
                    Outros
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-1.5 text-right font-medium">
                    Valor Total
                  </th>
                  <th className="whitespace-nowrap px-4 py-1.5 text-center font-medium">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {faturasVisiveis.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 text-left text-slate-700">
                      {typeof item.unidade.bloco === "string"
                        ? item.unidade.bloco || "—"
                        : item.unidade.bloco.nome}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-slate-900">
                      {item.unidade.tipoUnidade.nome} {item.unidade.numero}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-left text-slate-700">
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
                      className="min-w-[120px] px-4 py-1.5 text-sm font-medium text-slate-900"
                    />
                    <td className="whitespace-nowrap px-4 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => enviarWhatsApp(item)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 text-sm font-medium whitespace-nowrap text-white hover:bg-[#1ebe5a]"
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
                  <td className="whitespace-nowrap px-3 py-1.5 text-left" colSpan={3}>
                    Totais
                  </td>
                  <CelulaMoeda valor={totais.valorEnergia} />
                  <CelulaMoeda valor={totais.valorAgua} />
                  <CelulaMoeda valor={totais.valorGas} />
                  <CelulaMoeda valor={totais.valorOutras} />
                  <CelulaMoeda valor={totais.valorTotal} />
                  <td className="px-4 py-1.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
