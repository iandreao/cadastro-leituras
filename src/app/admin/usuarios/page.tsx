"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";
import { toTitleCase } from "@/lib/masks";
import {
  listarGestoresOpcoes,
  listarUsuarios,
  obterPerfilUsuarios,
  salvarUsuario,
  type GestorOpcao,
  type UsuarioLista,
} from "./actions";

function formularioVazio() {
  return {
    nome: "",
    email: "",
    senha: "",
    role: "OPERADOR" as "GESTOR_ADMIN" | "OPERADOR",
    gestorId: "",
  };
}

function rotuloRole(role: "GESTOR_ADMIN" | "OPERADOR") {
  return role === "GESTOR_ADMIN" ? "Gestor" : "Operador";
}

function formatarData(valor: Date | string) {
  const data = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleDateString("pt-BR");
}

export default function UsuariosPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [ehSuperAdmin, setEhSuperAdmin] = useState(false);
  const [form, setForm] = useState(formularioVazio);
  const [lista, setLista] = useState<UsuarioLista[]>([]);
  const [gestores, setGestores] = useState<GestorOpcao[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    const perfil = await obterPerfilUsuarios();

    if (!perfil.autorizado) {
      setAutorizado(false);
      return;
    }

    const superAdmin = perfil.role === "SUPER_ADMIN";
    setEhSuperAdmin(superAdmin);

    const [usuarios, gestoresLista] = await Promise.all([
      listarUsuarios(),
      superAdmin ? listarGestoresOpcoes() : Promise.resolve([]),
    ]);

    setLista(usuarios);
    setGestores(gestoresLista);
    setAutorizado(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setInfo("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const resultado = await salvarUsuario(formData);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      setForm(formularioVazio());
      setInfo("Usuário cadastrado com sucesso.");
      setLista(await listarUsuarios());
    });
  }

  if (autorizado === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-lg text-slate-600 shadow-sm" />
    );
  }

  if (!autorizado) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <p className="text-sm font-medium tracking-[0.2em] text-red-700 uppercase">
          Acesso restrito
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-red-950">
          Área exclusiva do gestor
        </h1>
        <p className="mt-3 text-base leading-6 text-red-800">
          O cadastro de operadores e usuários da administradora está disponível
          somente para GESTOR_ADMIN e SUPER_ADMIN.
        </p>
      </div>
    );
  }

  return (
    <div className={GRADE_CADASTRO}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Incluir usuário
        </h2>
        <form onSubmit={onSubmit} className={`${AREA_ROLAVEL} space-y-4 pr-1`}>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Nome
            </span>
            <input
              name="nome"
              value={form.nome}
              autoComplete="off"
              required
              minLength={3}
              onChange={(event) =>
                setForm((atual) => ({ ...atual, nome: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              E-mail
            </span>
            <input
              name="email"
              type="email"
              value={form.email}
              autoComplete="off"
              required
              onChange={(event) =>
                setForm((atual) => ({ ...atual, email: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Senha
            </span>
            <input
              name="senha"
              type="password"
              value={form.senha}
              autoComplete="new-password"
              required
              minLength={6}
              onChange={(event) =>
                setForm((atual) => ({ ...atual, senha: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Perfil
            </span>
            <select
              name="role"
              value={form.role}
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  role: event.target.value as "GESTOR_ADMIN" | "OPERADOR",
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            >
              <option value="OPERADOR">Operador</option>
              <option value="GESTOR_ADMIN">Gestor</option>
            </select>
          </label>
          {ehSuperAdmin ? (
            <label className="block">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Gestor / Cliente
              </span>
              <select
                name="gestorId"
                required
                value={form.gestorId}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    gestorId: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              >
                <option value="">Selecione o gestor</option>
                {gestores.map((gestor) => (
                  <option key={gestor.id} value={gestor.id}>
                    {gestor.nomeFantasia}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
            {pending ? "Salvando..." : "Incluir usuário"}
          </button>
        </form>
      </section>

      <aside className={CARTAO_LISTA}>
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Usuários do tenant
        </h3>
        {lista.length === 0 ? (
          <p className="text-lg text-slate-500">Nenhum usuário incluído.</p>
        ) : (
          <div className={`${AREA_ROLAVEL} rounded-md border border-gray-300`}>
            <table className="w-full border-collapse text-base">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Nome
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    E-mail
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Perfil
                  </th>
                  {ehSuperAdmin ? (
                    <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                      Gestor
                    </th>
                  ) : null}
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium whitespace-nowrap text-slate-700">
                    Cadastro
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="border border-gray-300 px-3 py-1 font-medium whitespace-nowrap text-slate-900">
                      {toTitleCase(item.nome)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 font-mono font-normal whitespace-nowrap text-slate-700">
                      {item.email}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {rotuloRole(item.role)}
                    </td>
                    {ehSuperAdmin ? (
                      <td className="border border-gray-300 px-3 py-1 text-slate-700">
                        {item.gestorNome ? toTitleCase(item.gestorNome) : "—"}
                      </td>
                    ) : null}
                    <td className="border border-gray-300 px-3 py-1 font-mono font-normal whitespace-nowrap tabular-nums text-slate-700">
                      {formatarData(item.createdAt)}
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
