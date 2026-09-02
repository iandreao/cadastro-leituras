"use client";

import { FormEvent, useMemo, useState } from "react";
import { nomeBloco, queryEscopoTipo } from "@/lib/blocos";
import { usePublicarCondominio } from "@/lib/condominio-selecionado";
import {
  FORMAS_COBRANCA_LABEL,
  ehAguaPorConsumo,
  formatarMoeda,
  parseValorMonetario,
  type FormaCobranca,
} from "@/lib/despesas";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";
import { MESES, anosReferencia, nomeMes } from "@/lib/leituras";

type Condominio = {
  id: string;
  nome: string;
};

type TipoDespesa = {
  id: string;
  nome: string;
};

type BlocoCadastro = {
  id: string;
  nome: string;
  condominioId: string;
};

type DespesaMensal = {
  id: string;
  blocoId: string;
  bloco: BlocoCadastro | string;
  mes: number;
  ano: number;
  valorTotal: number;
  valorFixo?: number | null;
  valorVariavel?: number | null;
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

export default function DespesaScreen({
  condominiosIniciais,
  tiposIniciais,
  blocosIniciais,
  despesasIniciais,
}: {
  condominiosIniciais: Condominio[];
  tiposIniciais: TipoDespesa[];
  blocosIniciais: BlocoCadastro[];
  despesasIniciais: DespesaMensal[];
}) {
  const [condominios] = useState(condominiosIniciais);
  const [tipos, setTipos] = useState<TipoDespesa[]>(tiposIniciais);
  const [blocos, setBlocos] = useState(blocosIniciais);
  const [despesas, setDespesas] = useState<DespesaMensal[]>(despesasIniciais);
  const [condominioId, setCondominioId] = useState("");
  const [blocoId, setBlocoId] = useState("");
  const [mes, setMes] = useState<number | "">("");
  const [ano, setAno] = useState<number | "">("");
  const [tipoDespesaId, setTipoDespesaId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorFixo, setValorFixo] = useState("");
  const [valorVariavel, setValorVariavel] = useState("");
  const [formaCobranca, setFormaCobranca] = useState<FormaCobranca>("consumo");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [salvando, setSalvando] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  const blocosDoCondominio = useMemo(
    () =>
      blocos
        .filter((item) => item.condominioId === condominioId)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [condominioId, blocos],
  );

  const tipoSelecionado = tipos.find((item) => item.id === tipoDespesaId);
  const aguaPorConsumo = ehAguaPorConsumo(
    tipoSelecionado?.nome ?? "",
    formaCobranca,
  );

  const despesasVisiveis = useMemo(() => {
    if (!condominioId) {
      return [];
    }

    return despesas.filter((item) => {
      if (item.condominioId !== condominioId) {
        return false;
      }

      if (blocoId && item.blocoId !== blocoId) {
        return false;
      }

      if (mes !== "" && item.mes !== mes) {
        return false;
      }

      if (ano !== "" && item.ano !== ano) {
        return false;
      }

      if (tipoDespesaId && item.tipoDespesaId !== tipoDespesaId) {
        return false;
      }

      return true;
    });
  }, [ano, blocoId, condominioId, despesas, mes, tipoDespesaId]);

  async function carregar(filtroCondominioId = condominioId, filtroBloco?: string) {
    const params = new URLSearchParams();

    if (filtroCondominioId) {
      params.set("condominioId", filtroCondominioId);
    }

    if (filtroBloco) {
      params.set("blocoId", filtroBloco);
    }

    const query = params.toString();
    const response = await fetch(query ? `/api/despesas?${query}` : "/api/despesas");
    const listaDespesas = (await response.json()) as DespesaMensal[];
    setDespesas(listaDespesas);
  }

  async function carregarTipos(id: string, blocoAtual: string) {
    if (!id || !blocoAtual) {
      setTipos([]);
      setTipoDespesaId("");
      return;
    }

    const response = await fetch(
      `/api/tipos-despesas?${queryEscopoTipo(id, blocoAtual)}`,
    );
    const listaTipos = (await response.json()) as TipoDespesa[] | { error?: string };

    if (response.ok && Array.isArray(listaTipos)) {
      setTipos(listaTipos);
      setTipoDespesaId((atual) =>
        listaTipos.some((tipo) => tipo.id === atual) ? atual : "",
      );
    } else {
      setTipos([]);
      setTipoDespesaId("");
    }
  }

  async function onCondominioChange(id: string) {
    setCondominioId(id);
    setBlocoId("");
    setErro("");
    setInfo("");

    if (!id) {
      setTipos([]);
      setTipoDespesaId("");
      return;
    }

    const resBlocos = await fetch(`/api/blocos?condominioId=${id}`);
    const listaBlocos = (await resBlocos.json()) as BlocoCadastro[] | { error?: string };
    setBlocos((atual) => {
      const demais = atual.filter((item) => item.condominioId !== id);
      return [...demais, ...(Array.isArray(listaBlocos) ? listaBlocos : [])];
    });
    setTipos([]);
    setTipoDespesaId("");
    await carregar(id, undefined);
  }

  function cancelar() {
    setEditandoId(null);
    setValorTotal("");
    setValorFixo("");
    setValorVariavel("");
    setFormaCobranca("consumo");
    setErro("");
    setInfo("");
  }

  async function alterar(item: DespesaMensal) {
    setErro("");
    setInfo("");
    setEditandoId(item.id);
    setCondominioId(item.condominioId);
    setBlocoId(item.blocoId);
    setMes(item.mes);
    setAno(item.ano);
    setFormaCobranca(
      item.formaCobranca === "divisao_igual" ? "divisao_igual" : "consumo",
    );
    setValorTotal(String(item.valorTotal ?? ""));
    setValorFixo(item.valorFixo != null ? String(item.valorFixo) : "");
    setValorVariavel(
      item.valorVariavel != null ? String(item.valorVariavel) : "",
    );

    const resBlocos = await fetch(
      `/api/blocos?condominioId=${item.condominioId}`,
    );
    const listaBlocos = (await resBlocos.json()) as
      | BlocoCadastro[]
      | { error?: string };
    setBlocos((atual) => {
      const demais = atual.filter(
        (bloco) => bloco.condominioId !== item.condominioId,
      );
      return [...demais, ...(Array.isArray(listaBlocos) ? listaBlocos : [])];
    });
    await carregarTipos(item.condominioId, item.blocoId);
    setTipoDespesaId(item.tipoDespesaId);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");
    setSalvando(true);

    try {
      const fixo = parseValorMonetario(valorFixo);
      const variavel = parseValorMonetario(valorVariavel);
      const total = aguaPorConsumo
        ? (Number.isFinite(fixo) ? fixo : 0) + (Number.isFinite(variavel) ? variavel : 0)
        : parseValorMonetario(valorTotal);

      const url = editandoId
        ? `/api/despesas/${editandoId}`
        : "/api/despesas";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId,
          blocoId,
          mes,
          ano,
          tipoDespesaId,
          valorTotal: total,
          valorFixo: aguaPorConsumo && Number.isFinite(fixo) ? fixo : null,
          valorVariavel:
            aguaPorConsumo && Number.isFinite(variavel) ? variavel : null,
          formaCobranca,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(
          data.error ??
            (editandoId
              ? "Não foi possível atualizar a despesa."
              : "Não foi possível cadastrar a despesa."),
        );
        return;
      }

      const alterando = Boolean(editandoId);
      setValorTotal("");
      setValorFixo("");
      setValorVariavel("");
      setEditandoId(null);
      setInfo(alterando ? "Despesa atualizada." : "Despesa lançada.");
      await carregar(condominioId);
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
    if (editandoId === item.id) {
      cancelar();
    }
  }

  return (
    <div className={GRADE_CADASTRO}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="shrink-0 text-3xl font-medium text-slate-900">
          Incluir Despesas do Mês
        </h2>
        <p className="mt-1 shrink-0 text-lg text-slate-600">
          Informe o valor total da despesa e como ela será cobrada nas unidades.
        </p>

        <form
          className={`mt-6 space-y-4 ${AREA_ROLAVEL} pr-1`}
          onSubmit={onSubmit}
        >
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
              Bloco/Torre
            </span>
            <select
              required
              value={blocoId}
              onChange={(event) => {
                const valor = event.target.value;
                setBlocoId(valor);
                setTipoDespesaId("");
                if (condominioId) {
                  void carregarTipos(condominioId, valor);
                }
              }}
              disabled={!condominioId}
              className={campoClass}
            >
              <option value="">Selecione o bloco</option>
              {blocosDoCondominio.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            {condominioId && blocosDoCondominio.length === 0 ? (
              <span className="mt-1 block text-base text-slate-500">
                Cadastre os blocos em Configurações → Blocos / Torres.
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-lg font-medium text-slate-700">
                Mês
              </span>
              <select
                required
                value={mes}
                onChange={(event) => {
                  const valor = event.target.value;
                  setMes(valor ? Number(valor) : "");
                }}
                className={campoClass}
              >
                <option value="">Selecione</option>
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
                onChange={(event) => {
                  const valor = event.target.value;
                  setAno(valor ? Number(valor) : "");
                }}
                className={campoClass}
              >
                <option value="">Selecione</option>
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

          {aguaPorConsumo ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Valor Fixo (R$)
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorFixo}
                  onChange={(event) => setValorFixo(event.target.value)}
                  className={campoClass}
                  placeholder="0,00"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Valor Variável (R$)
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorVariavel}
                  onChange={(event) => setValorVariavel(event.target.value)}
                  className={campoClass}
                  placeholder="0,00"
                />
              </label>
            </div>
          ) : (
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
          )}

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
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar alteração"
                  : "Lançar despesa"}
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

      <section className={CARTAO_LISTA}>
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Despesas Cadastradas
        </h3>

        {!condominioId ? (
          <p className="text-lg text-slate-500">
            Selecione o condomínio para listar as despesas.
          </p>
        ) : despesasVisiveis.length === 0 ? (
          <p className="text-lg text-slate-500">
            Nenhuma despesa encontrada para os filtros selecionados.
          </p>
        ) : (
          <div className={`${AREA_ROLAVEL} rounded-md border border-gray-300`}>
            <table className="w-full border-collapse text-base">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="min-w-[12rem] border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Tipo
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium whitespace-nowrap text-slate-700">
                    Período
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Bloco
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-right font-medium whitespace-nowrap text-slate-700">
                    Valor
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-medium whitespace-nowrap text-slate-700">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {despesasVisiveis.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      editandoId === item.id ? "bg-teal-50/70" : "bg-white"
                    }
                  >
                    <td className="border border-gray-300 px-3 py-1 font-medium text-slate-900">
                      {item.tipoDespesa.nome}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 whitespace-nowrap text-slate-700">
                      {nomeMes(item.mes)}/{item.ano}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 whitespace-nowrap text-slate-700">
                      {nomeBloco(item.bloco) || "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-right whitespace-nowrap text-slate-800">
                      {formatarMoeda(item.valorTotal)}
                    </td>
                    <td className="border border-gray-300 p-0 align-middle">
                      <div className="flex items-center justify-center gap-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => void alterar(item)}
                          className="rounded-md bg-sky-400 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-sky-500"
                        >
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluir(item)}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
