"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";
import { maskCnpj, toTitleCase } from "@/lib/masks";
import AcessoRestrito from "@/components/AcessoRestrito";
import {
  criarGestor,
  listarGestores,
  obterPerfilAdmin,
  type GestorLista,
} from "./actions";

function formularioVazio() {
  return {
    nomeFantasia: "",
    razaoSocial: "",
    cnpj: "",
  };
}

export default function GestoresPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [lista, setLista] = useState<GestorLista[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    const perfil = await obterPerfilAdmin();

    if (!perfil.autorizado) {
      setAutorizado(false);
      return;
    }

    const gestores = await listarGestores();
    setLista(gestores);
    setAutorizado(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setInfo("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const resultado = await criarGestor(formData);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      setForm(formularioVazio());
      setInfo("Gestor cadastrado com sucesso.");
      setLista(await listarGestores());
    });
  }

  if (autorizado === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-lg text-slate-600 shadow-sm">
        Verificando permissão de acesso...
      </div>
    );
  }

  if (!autorizado) {
    return <AcessoRestrito />;
  }

  return (
    <div className={GRADE_CADASTRO}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Incluir gestor
        </h2>
        <form onSubmit={onSubmit} className={`${AREA_ROLAVEL} space-y-4 pr-1`}>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Nome fantasia
            </span>
            <input
              name="nomeFantasia"
              value={form.nomeFantasia}
              autoComplete="off"
              required
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  nomeFantasia: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Razão social
            </span>
            <input
              name="razaoSocial"
              value={form.razaoSocial}
              autoComplete="off"
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  razaoSocial: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              CNPJ
            </span>
            <input
              name="cnpj"
              value={form.cnpj}
              autoComplete="off"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  cnpj: maskCnpj(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>

          {info ? (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800">
              {info}
            </p>
          ) : null}
          {erro ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
              {erro}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-lg font-medium text-white hover:bg-teal-800 disabled:opacity-70"
          >
            {pending ? "Salvando..." : "Incluir gestor"}
          </button>
        </form>
      </section>

      <aside className={CARTAO_LISTA}>
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Gestores cadastrados
        </h3>
        {lista.length === 0 ? (
          <p className="text-lg text-slate-500">Nenhum gestor incluído.</p>
        ) : (
          <div className={`${AREA_ROLAVEL} rounded-md border border-gray-300`}>
            <table className="w-full border-collapse text-base">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Nome fantasia
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Razão social
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium whitespace-nowrap text-slate-700">
                    CNPJ
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="border border-gray-300 px-3 py-1 font-medium whitespace-nowrap text-slate-900">
                      {toTitleCase(item.nomeFantasia)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {item.razaoSocial ? toTitleCase(item.razaoSocial) : "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 font-mono font-normal whitespace-nowrap tabular-nums text-slate-700">
                      {item.cnpj ? maskCnpj(item.cnpj) : "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {item.ativo ? "Ativo" : "Inativo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </aside>
    </div>
  );
}
