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
  blocoId: string;
  condominioId: string;
  _count?: {
    unidades: number;
  };
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export default function TiposUnidadeScreen({
  condominios,
}: {
  condominios: Condominio[];
}) {
  const [tipos, setTipos] = useState<TipoUnidade[]>([]);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [condominioId, setCondominioId] = useState("");
  const [blocoId, setBlocoId] = useState("");
  const [nome, setNome] = useState("");
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
      return;
    }

    const response = await fetch(
      `/api/tipos-unidades?${queryEscopoTipo(id, blocoAtual)}`,
    );
    const lista = (await response.json()) as TipoUnidade[] | { error?: string };

    if (!response.ok || !Array.isArray(lista)) {
      setTipos([]);
      setErro(
        !Array.isArray(lista) && lista.error
          ? lista.error
          : "Não foi possível carregar os tipos.",
      );
      return;
    }

    setTipos(lista);
  }

  async function onCondominioChange(id: string) {
    setCondominioId(id);
    setBlocoId("");
    setNome("");
    setEditandoId(null);
    setErro("");
    setInfo("");
    setTipos([]);
    await carregarBlocos(id);
  }

  async function onBlocoChange(valor: string) {
    setBlocoId(valor);
    setNome("");
    setEditandoId(null);
    setErro("");
    setInfo("");
    await carregar(condominioId, valor);
  }

  function cancelar() {
    setNome("");
    setEditandoId(null);
    setErro("");
    setInfo("");
  }

  function alterar(item: TipoUnidade) {
    setNome(item.nome);
    setBlocoId(item.blocoId);
    setEditandoId(item.id);
    setErro("");
    setInfo("");
  }

  async function excluir(item: TipoUnidade) {
    if (!condominioId || !blocoId) {
      setErro("Selecione o condomínio e o bloco/torre.");
      return;
    }

    if (!confirm("Excluir este tipo de unidade?")) {
      return;
    }

    setErro("");
    setInfo("");

    const response = await fetch(
      `/api/tipos-unidades/${item.id}?${queryEscopoTipo(condominioId, blocoId)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErro(
        data.error ??
          "Não é possível excluir um tipo de unidade se existir uma unidade ou despesa correlacionada",
      );
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
        ? `/api/tipos-unidades/${editandoId}`
        : "/api/tipos-unidades";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, condominioId, blocoId }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }

      setNome("");
      setEditandoId(null);
      setInfo(editandoId ? "Tipo de unidade atualizado." : "Tipo de unidade cadastrado.");
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
          {editandoId ? "Alterar tipo de unidade" : "Incluir Tipo de Unidades"}
        </h2>
        <p className="mt-1 shrink-0 text-lg text-slate-600">
          Cadastre os nomes usados no cadastro de unidades (Apartamento, Loja,
          etc.).
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
              placeholder="Apartamento"
            />
          </label>

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
          Tipos de Unidades Cadastrados
        </h3>

        {erro && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
            {erro}
          </p>
        )}

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
                  <th className="min-w-[16rem] border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Descrição
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-medium whitespace-nowrap text-slate-700">
                    Nr. Ud
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
                    <td className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-900">
                      {item.nome}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center text-slate-800">
                      {item._count?.unidades ?? 0}
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
