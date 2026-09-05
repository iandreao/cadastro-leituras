"use client";

import { FormEvent, useMemo, useState } from "react";
import { queryEscopoTipo } from "@/lib/blocos";
import { usePublicarCondominio } from "@/lib/condominio-selecionado";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";

type Condominio = {
  id: string;
  nome: string;
};

type Bloco = {
  id: string;
  nome: string;
};

type TipoUnidade = {
  id: string;
  nome: string;
};

type TipoDespesa = {
  id: string;
  nome: string;
  blocoId: string;
  condominioId: string;
  regras: {
    tipoUnidadeId: string;
    tipoUnidade: { id: string; nome: string };
  }[];
  _count?: {
    despesas: number;
  };
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export default function TiposDespesaScreen({
  condominios,
}: {
  condominios: Condominio[];
}) {
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [tiposUnidade, setTiposUnidade] = useState<TipoUnidade[]>([]);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [condominioId, setCondominioId] = useState("");
  const [blocoId, setBlocoId] = useState("");
  const [nome, setNome] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [salvando, setSalvando] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  const podeListar = Boolean(condominioId && blocoId);

  const tiposVisiveis = useMemo(
    () =>
      tipos.filter(
        (item) => item.condominioId === condominioId && item.blocoId === blocoId,
      ),
    [tipos, condominioId, blocoId],
  );

  async function carregarBlocos(id: string) {
    if (!id) {
      setBlocos([]);
      return [];
    }

    const response = await fetch(`/api/blocos?condominioId=${id}`);
    const lista = (await response.json()) as Bloco[] | { error?: string };
    const cadastrados = Array.isArray(lista) ? lista : [];
    setBlocos(cadastrados);
    return cadastrados;
  }

  async function carregar(id = condominioId, blocoAtual = blocoId) {
    if (!id || !blocoAtual) {
      setTipos([]);
      setTiposUnidade([]);
      return;
    }

    const query = queryEscopoTipo(id, blocoAtual);
    const [resDespesas, resUnidades] = await Promise.all([
      fetch(`/api/tipos-despesas?${query}`),
      fetch(`/api/tipos-unidades?${query}`),
    ]);
    const listaDespesas = (await resDespesas.json()) as
      | TipoDespesa[]
      | { error?: string };
    const listaUnidades = (await resUnidades.json()) as
      | TipoUnidade[]
      | { error?: string };

    if (!resDespesas.ok || !Array.isArray(listaDespesas)) {
      setTipos([]);
      setErro(
        !Array.isArray(listaDespesas) && listaDespesas.error
          ? listaDespesas.error
          : "Não foi possível carregar os tipos de despesa.",
      );
      return;
    }

    setTipos(listaDespesas);
    setTiposUnidade(Array.isArray(listaUnidades) ? listaUnidades : []);
  }

  async function onCondominioChange(id: string) {
    setCondominioId(id);
    setBlocoId("");
    setNome("");
    setSelecionados([]);
    setEditandoId(null);
    setErro("");
    setInfo("");
    setTipos([]);
    setTiposUnidade([]);
    await carregarBlocos(id);
  }

  async function onBlocoChange(valor: string) {
    setBlocoId(valor);
    setNome("");
    setSelecionados([]);
    setEditandoId(null);
    setErro("");
    setInfo("");
    await carregar(condominioId, valor);
  }

  function cancelar() {
    setNome("");
    setSelecionados([]);
    setEditandoId(null);
    setErro("");
    setInfo("");
  }

  function alterar(item: TipoDespesa) {
    setNome(item.nome);
    setBlocoId(item.blocoId);
    setSelecionados(item.regras.map((regra) => regra.tipoUnidadeId));
    setEditandoId(item.id);
    setErro("");
    setInfo("");
  }

  function alternarTipo(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  async function excluir(item: TipoDespesa) {
    if (!condominioId || !blocoId) {
      setErro("Selecione o condomínio e o bloco/torre.");
      return;
    }

    if ((item._count?.despesas ?? 0) > 0) {
      setErro("Não é possível excluir: há despesas lançadas com este tipo.");
      return;
    }

    if (!confirm("Excluir este tipo de despesa?")) {
      return;
    }

    const response = await fetch(
      `/api/tipos-despesas/${item.id}?${queryEscopoTipo(condominioId, blocoId)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErro(data.error ?? "Não foi possível excluir.");
      return;
    }

    if (editandoId === item.id) {
      cancelar();
    }

    await carregar();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");

    if (!blocoId) {
      setErro("Selecione o bloco/torre.");
      return;
    }

    setSalvando(true);

    try {
      const url = editandoId
        ? `/api/tipos-despesas/${editandoId}`
        : "/api/tipos-despesas";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          condominioId,
          blocoId,
          tipoUnidadeIds: selecionados,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }

      const eraEdicao = Boolean(editandoId);
      cancelar();
      setInfo(
        eraEdicao
          ? "Tipo de despesa atualizado."
          : "Tipo de despesa cadastrado com as regras de participação.",
      );
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={GRADE_CADASTRO}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="shrink-0 text-3xl font-medium text-slate-900">
          {editandoId ? "Alterar tipo de despesa" : "Incluir Tipos de Despesas"}
        </h2>
        <p className="mt-1 shrink-0 text-lg text-slate-600">
          Cadastre o nome da despesa e marque quais tipos de unidade participam
          do rateio.
        </p>

        <form className={`mt-6 space-y-4 ${AREA_ROLAVEL} pr-1`} onSubmit={onSubmit}>
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
              onChange={(event) => void onBlocoChange(event.target.value)}
              disabled={!condominioId}
              className={campoClass}
            >
              <option value="">Selecione o bloco</option>
              {blocos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            {condominioId && blocos.length === 0 ? (
              <span className="mt-1 block text-base text-slate-500">
                Cadastre os blocos em Configurações → Blocos / Torres.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Nome
            </span>
            <input
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={campoClass}
              placeholder="Faxina"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 block text-lg font-medium text-slate-700">
              Tipos de unidade que participam
            </legend>
            {!condominioId ? (
              <p className="rounded-xl border border-slate-200 p-3 text-lg text-slate-500">
                Selecione o condomínio para ver os tipos de unidade.
              </p>
            ) : !blocoId ? (
              <p className="rounded-xl border border-slate-200 p-3 text-lg text-slate-500">
                Selecione o bloco/torre para ver os tipos de unidade.
              </p>
            ) : tiposUnidade.length === 0 ? (
              <p className="rounded-xl border border-slate-200 p-3 text-lg text-slate-500">
                Cadastre os tipos de unidade deste condomínio e bloco antes de
                definir a participação.
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {tiposUnidade.map((tipo) => (
                  <label
                    key={tipo.id}
                    className="flex cursor-pointer items-center gap-3 text-lg text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.includes(tipo.id)}
                      onChange={() => alternarTipo(tipo.id)}
                      className="h-5 w-5 accent-teal-700"
                    />
                    {tipo.nome}
                  </label>
                ))}
              </div>
            )}
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
              disabled={salvando || !podeListar}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-lg font-medium text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {salvando ? "Salvando..." : editandoId ? "Salvar alteração" : "Incluir"}
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
          Tipos de Despesas Cadastrados
        </h3>

        {!condominioId ? (
          <p className="text-lg text-slate-500">
            Selecione o condomínio para listar os tipos.
          </p>
        ) : !blocoId ? (
          <p className="text-lg text-slate-500">
            Selecione o bloco/torre para listar os tipos.
          </p>
        ) : tiposVisiveis.length === 0 ? (
          <p className="text-lg text-slate-500">Nenhum tipo cadastrado.</p>
        ) : (
          <div className={`${AREA_ROLAVEL} rounded-md border border-gray-300`}>
            <table className="w-full border-collapse text-base">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="border border-gray-300 px-3 py-1 text-center font-medium text-slate-700">
                    Código
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Descrição
                  </th>
                  <th className="min-w-[16rem] border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Participação
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-medium whitespace-nowrap text-slate-700">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {tiposVisiveis.map((item, indice) => (
                  <tr
                    key={item.id}
                    className={
                      editandoId === item.id ? "bg-teal-50/70" : "bg-white"
                    }
                  >
                    <td className="border border-gray-300 px-3 py-1 text-center text-slate-800">
                      {String(indice + 1).padStart(3, "0")}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 font-medium whitespace-nowrap text-slate-900">
                      {item.nome}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {item.regras.length === 0
                        ? "Nenhum"
                        : item.regras
                            .map((regra) => regra.tipoUnidade.nome)
                            .join(", ")}
                    </td>
                    <td className="border border-gray-300 p-0 align-middle">
                      <div className="flex items-center justify-center gap-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => alterar(item)}
                          className="rounded-md bg-sky-400 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-sky-500"
                        >
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluir(item)}
                          disabled={(item._count?.despesas ?? 0) > 0}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
