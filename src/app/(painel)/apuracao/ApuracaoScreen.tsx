"use client";

import { FormEvent, useState } from "react";
import { formatarMoeda } from "@/lib/despesas";
import { MESES, anosReferencia } from "@/lib/leituras";
import { toTitleCase } from "@/lib/masks";

type Condominio = {
  id: string;
  nome: string;
};

type FaturaUnidade = {
  id: string;
  valorAgua: number;
  valorEnergia: number;
  valorGas: number;
  valorOutras: number;
  valorTotal: number;
  unidade: {
    id: string;
    numero: string;
    bloco: string;
    nomeMorador: string;
    tipoUnidade: string;
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

  const totais = faturas.reduce(
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
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm">
        <h2 className="text-3xl font-medium text-slate-900">
          Apuração de Despesas
        </h2>
        <p className="mt-1 text-lg text-slate-600">
          Selecione o condomínio e o mês de referência para ratear as despesas
          entre as unidades.
        </p>

        <form
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={onSubmit}
        >
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
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

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
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

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
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

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={processando}
              className="w-full rounded-xl bg-blue-600 px-16 py-3 text-xl font-semibold tracking-wide text-white uppercase hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {processando ? "Processando..." : "Processar Apuração do Mês"}
            </button>
          </div>

          {info && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800 md:col-span-2">
              {info}
            </p>
          )}
          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700 md:col-span-2">
              {erro}
            </p>
          )}
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-2xl font-medium text-slate-900">
          Resultado da apuração
        </h3>

        {faturas.length === 0 ? (
          <p className="text-lg text-slate-500">
            Processe um mês para exibir os valores por unidade.
          </p>
        ) : (
          <div className="max-h-[calc(100vh-16rem)] overflow-auto pr-2">
            <table className="min-w-full border-collapse text-lg">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-slate-700">
                  <th className="px-3 py-2 font-medium">Bloco</th>
                  <th className="px-3 py-2 font-medium">Unidade</th>
                  <th className="px-3 py-2 font-medium">Morador</th>
                  <th className="px-3 py-2 text-right font-medium">Valor Água</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Valor Energia
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Valor Gás</th>
                  <th className="px-3 py-2 text-right font-medium">Outros</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">
                      {item.unidade.bloco || "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {item.unidade.tipoUnidade} {item.unidade.numero}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {item.unidade.nomeMorador
                        ? toTitleCase(item.unidade.nomeMorador)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {formatarMoeda(item.valorAgua)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {formatarMoeda(item.valorEnergia)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {formatarMoeda(item.valorGas)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {formatarMoeda(item.valorOutras)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {formatarMoeda(item.valorTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-medium text-slate-900">
                  <td className="px-3 py-2" colSpan={3}>
                    Totais
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatarMoeda(totais.valorAgua)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatarMoeda(totais.valorEnergia)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatarMoeda(totais.valorGas)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatarMoeda(totais.valorOutras)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatarMoeda(totais.valorTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
