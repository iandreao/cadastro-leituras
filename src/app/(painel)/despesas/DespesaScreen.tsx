"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FORMAS_COBRANCA_LABEL,
  formatarMoeda,
  rotuloFormaCobranca,
  type FormaCobranca,
} from "@/lib/despesas";
import { MESES, anosReferencia, nomeMes } from "@/lib/leituras";

type Condominio = {
  id: string;
  nome: string;
};

type TipoDespesa = {
  id: string;
  nome: string;
};

type UnidadeBloco = {
  id: string;
  bloco: string;
  condominioId: string;
};

type DespesaMensal = {
  id: string;
  bloco: string;
  mes: number;
  ano: number;
  valorTotal: number;
  formaCobranca: string;
  condominioId: string;
  tipoDespesaId: string;
  condominio: {
    id: string;
    nome: string;
  };
  tipoDespesa: {
    id: string;
    nome: string;
  };
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const agora = new Date();

export default function DespesaScreen({
  condominiosIniciais,
  tiposIniciais,
  unidadesIniciais,
  despesasIniciais,
}: {
  condominiosIniciais: Condominio[];
  tiposIniciais: TipoDespesa[];
  unidadesIniciais: UnidadeBloco[];
  despesasIniciais: DespesaMensal[];
}) {
  const [condominios] = useState(condominiosIniciais);
  const [tipos] = useState(tiposIniciais);
  const [unidades, setUnidades] = useState(unidadesIniciais);
  const [despesas, setDespesas] = useState(despesasIniciais);
  const [condominioId, setCondominioId] = useState("");
  const [bloco, setBloco] = useState("");
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [tipoDespesaId, setTipoDespesaId] = useState(tiposIniciais[0]?.id ?? "");
  const [valorTotal, setValorTotal] = useState("");
  const [formaCobranca, setFormaCobranca] = useState<FormaCobranca>("consumo");
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const blocosDoCondominio = useMemo(() => {
    const nomes = new Set<string>();

    for (const unidade of unidades) {
      if (unidade.condominioId === condominioId && unidade.bloco.trim()) {
        nomes.add(unidade.bloco.trim());
      }
    }

    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [condominioId, unidades]);

  const temUnidadeSemBloco = useMemo(
    () =>
      unidades.some(
        (unidade) =>
          unidade.condominioId === condominioId && !unidade.bloco.trim(),
      ),
    [condominioId, unidades],
  );

  async function carregar(filtroCondominioId = condominioId, filtroBloco?: string) {
    const params = new URLSearchParams();

    if (filtroCondominioId) {
      params.set("condominioId", filtroCondominioId);
    }

    if (filtroBloco !== undefined) {
      params.set("bloco", filtroBloco);
    }

    const query = params.toString();
    const response = await fetch(query ? `/api/despesas?${query}` : "/api/despesas");
    const listaDespesas = (await response.json()) as DespesaMensal[];
    setDespesas(listaDespesas);
  }

  async function onCondominioChange(id: string) {
    setCondominioId(id);
    setBloco("");
    setErro("");
    setInfo("");

    if (!id) {
      await carregar("", undefined);
      return;
    }

    const response = await fetch(`/api/unidades?condominioId=${id}`);
    const listaUnidades = (await response.json()) as UnidadeBloco[];
    setUnidades((atual) => {
      const demais = atual.filter((item) => item.condominioId !== id);
      return [...demais, ...listaUnidades];
    });
    await carregar(id, undefined);
  }

  function cancelar() {
    setBloco("");
    setTipoDespesaId(tipos[0]?.id ?? "");
    setValorTotal("");
    setFormaCobranca("consumo");
    setErro("");
    setInfo("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");
    setSalvando(true);

    try {
      const response = await fetch("/api/despesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId,
          bloco,
          mes,
          ano,
          tipoDespesaId,
          valorTotal: Number(valorTotal.replace(",", ".")),
          formaCobranca,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível cadastrar a despesa.");
        return;
      }

      setValorTotal("");
      setInfo("Despesa lançada.");
      await carregar(condominioId, undefined);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item: DespesaMensal) {
    if (!confirm("Excluir esta despesa?")) {
      return;
    }

    setErro("");
    setInfo("");

    const response = await fetch(`/api/despesas/${item.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErro(data.error ?? "Não foi possível excluir a despesa.");
      return;
    }

    setDespesas((atual) => atual.filter((despesa) => despesa.id !== item.id));
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 md:grid-cols-2">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm">
        <h2 className="text-3xl font-medium text-slate-900">
          Incluir Despesas do Mês
        </h2>
        <p className="mt-1 text-lg text-slate-600">
          Informe o valor total da despesa e como ela será cobrada nas unidades.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Condomínio
            </span>
            <select
              required
              value={condominioId}
              onChange={(event) => void onCondominioChange(event.target.value)}
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
              Bloco
            </span>
            <select
              value={bloco}
              onChange={(event) => {
                const valor = event.target.value;
                setBloco(valor);
                if (condominioId) {
                  void carregar(condominioId, valor || undefined);
                }
              }}
              disabled={!condominioId}
              className={campoClass}
            >
              <option value="">
                {temUnidadeSemBloco || blocosDoCondominio.length === 0
                  ? "Todo o condomínio"
                  : "Selecione o bloco"}
              </option>
              {blocosDoCondominio.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Tipo de despesa
            </span>
            <select
              required
              value={tipoDespesaId}
              onChange={(event) => setTipoDespesaId(event.target.value)}
              className={campoClass}
            >
              <option value="">Selecione</option>
              {tipos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Valor total
            </span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={valorTotal}
              onChange={(event) => setValorTotal(event.target.value)}
              className={campoClass}
              placeholder="0,00"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 block text-lg font-medium text-slate-700">
              Forma de Rateio
            </legend>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              {(Object.keys(FORMAS_COBRANCA_LABEL) as FormaCobranca[]).map(
                (forma) => (
                  <label
                    key={forma}
                    className="flex cursor-pointer items-center gap-3 text-lg text-slate-800"
                  >
                    <input
                      type="radio"
                      name="formaCobranca"
                      value={forma}
                      checked={formaCobranca === forma}
                      onChange={() => setFormaCobranca(forma)}
                      className="h-5 w-5 accent-teal-700"
                    />
                    {FORMAS_COBRANCA_LABEL[forma]}
                  </label>
                ),
              )}
            </div>
          </fieldset>

          {info && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800">
              {info}
            </p>
          )}
          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
              {erro}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-lg font-medium text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {salvando ? "Salvando..." : "Lançar despesa"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>

      <section className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Despesas cadastradas
        </h3>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {despesas.length === 0 && (
            <p className="text-lg text-slate-500">Nenhuma despesa lançada.</p>
          )}

          {despesas.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <p className="text-lg font-medium text-slate-900">
                {item.tipoDespesa.nome} • {formatarMoeda(item.valorTotal)}
              </p>
              <p className="mt-1 text-lg text-slate-600">
                {item.condominio.nome}
                {item.bloco ? ` • ${item.bloco}` : ""}
              </p>
              <p className="mt-1 text-lg text-slate-600">
                {nomeMes(item.mes)}/{item.ano} •{" "}
                {rotuloFormaCobranca(item.formaCobranca)}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void excluir(item)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-lg font-medium text-white"
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
