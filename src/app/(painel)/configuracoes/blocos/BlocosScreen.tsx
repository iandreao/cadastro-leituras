"use client";

import { FormEvent, useEffect, useState } from "react";
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
  condominioId: string;
  _count?: {
    unidades: number;
    tiposUnidade: number;
    tiposDespesa: number;
    despesasMensais: number;
  };
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export default function BlocosScreen({
  condominios,
}: {
  condominios: Condominio[];
}) {
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [condominioId, setCondominioId] = useState("");
  const [nome, setNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [salvando, setSalvando] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  function idAtivo(id: unknown) {
    return String(id ?? "").trim();
  }

  function mesmoCondominio(bloco: Bloco, id: string) {
    return idAtivo(bloco.condominioId) === idAtivo(id);
  }

  async function carregar(id = condominioId) {
    const condominioAtivo = idAtivo(id);

    if (!condominioAtivo) {
      setBlocos([]);
      return;
    }

    const response = await fetch(
      `/api/blocos?condominioId=${encodeURIComponent(condominioAtivo)}`,
    );
    const lista = (await response.json()) as Bloco[] | { error?: string };

    if (!response.ok || !Array.isArray(lista)) {
      setBlocos([]);
      setErro(
        !Array.isArray(lista) && lista.error
          ? lista.error
          : "Não foi possível carregar os blocos.",
      );
      return;
    }

    setBlocos(
      lista.filter((item) => mesmoCondominio(item, condominioAtivo)),
    );
  }

  useEffect(() => {
    void carregar(condominioId);
  }, [condominioId]);

  async function onCondominioChange(id: string) {
    setCondominioId(idAtivo(id));
    setNome("");
    setEditandoId(null);
    setErro("");
    setInfo("");
  }

  function cancelar() {
    setNome("");
    setEditandoId(null);
    setErro("");
    setInfo("");
  }

  function alterar(item: Bloco) {
    setNome(item.nome);
    setEditandoId(item.id);
    setErro("");
    setInfo("");
  }

  async function excluir(item: Bloco) {
    if (!condominioId) {
      setErro("Selecione o condomínio.");
      return;
    }

    if (!confirm("Excluir este bloco/torre?")) {
      return;
    }

    setErro("");
    setInfo("");

    const response = await fetch(
      `/api/blocos/${item.id}?condominioId=${encodeURIComponent(String(condominioId))}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErro(data.error ?? "Não foi possível excluir o bloco/torre.");
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
    setSalvando(true);

    try {
      const url = editandoId ? `/api/blocos/${editandoId}` : "/api/blocos";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          condominioId: String(condominioId).trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }

      setNome("");
      setEditandoId(null);
      setInfo(editandoId ? "Bloco/torre atualizado." : "Bloco/torre cadastrado.");
      await carregar(idAtivo(condominioId));
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const blocosDoCondominio = blocos.filter((item) =>
    mesmoCondominio(item, condominioId),
  );

  return (
    <div className={GRADE_CADASTRO}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="shrink-0 text-3xl font-medium text-slate-900">
          {editandoId ? "Alterar bloco/torre" : "Incluir Blocos / Torres"}
        </h2>
        <p className="mt-1 shrink-0 text-lg text-slate-600">
          Cadastre as divisões do condomínio (Bloco A, Torre B ou Não se
          Aplica).
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
                <option key={String(item.id)} value={String(item.id)}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Nome do bloco/torre
            </span>
            <input
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={campoClass}
              placeholder="Bloco A, Torre B, Não se Aplica"
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
              disabled={salvando || !condominioId}
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
          Blocos / Torres Cadastrados
        </h3>

        {!condominioId ? (
          <p className="text-lg text-slate-500">
            Selecione o condomínio para listar os blocos.
          </p>
        ) : blocosDoCondominio.length === 0 ? (
          <p className="text-lg text-slate-500">Nenhum bloco cadastrado.</p>
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
                {blocosDoCondominio.map((item, indice) => (
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
