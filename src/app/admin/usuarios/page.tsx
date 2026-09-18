"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";
import { toTitleCase } from "@/lib/masks";
import { CAMPO, ROTULO_CAMPO } from "@/lib/ui-form";
import AcessoRestrito from "@/components/AcessoRestrito";
import {
  excluirUsuario,
  listarGestoresOpcoes,
  listarUsuarios,
  obterPerfilUsuarios,
  salvarUsuario,
  type GestorOpcao,
  type UsuarioLista,
} from "./actions";

const BOTAO_PRIMARIO =
  "inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70";
const BOTAO_SECUNDARIO =
  "inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70";

function formularioVazio() {
  return {
    id: "",
    nome: "",
    email: "",
    senha: "",
    role: "OPERADOR" as "GESTOR_ADMIN" | "OPERADOR",
    ativo: true,
    gestorId: "",
  };
}

function rotuloRole(role: "GESTOR_ADMIN" | "OPERADOR") {
  return role === "GESTOR_ADMIN" ? "Gestor Adm" : "Usuário";
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
  const editando = Boolean(form.id);

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

  function limparFormulario() {
    setForm(formularioVazio());
    setErro("");
    setInfo("");
  }

  function alterar(item: UsuarioLista) {
    setForm({
      id: item.id,
      nome: item.nome,
      email: item.email,
      senha: "",
      role: item.role,
      ativo: item.ativo,
      gestorId: item.gestorId ?? "",
    });
    setErro("");
    setInfo("");
  }

  function excluir(item: UsuarioLista) {
    if (
      !window.confirm(
        `Excluir o usuário "${toTitleCase(item.nome)}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setErro("");
    setInfo("");
    startTransition(async () => {
      const resultado = await excluirUsuario(item.id);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      if (form.id === item.id) {
        setForm(formularioVazio());
      }

      setInfo("Usuário excluído.");
      setLista(await listarUsuarios());
    });
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

      limparFormulario();
      setInfo(
        editando
          ? "Usuário atualizado com sucesso."
          : "Usuário cadastrado. Senha inicial: Mudar@123. No primeiro login será obrigatório alterá-la.",
      );
      setLista(await listarUsuarios());
    });
  }

  if (autorizado === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 font-sans text-sm text-slate-600 shadow-sm" />
    );
  }

  if (!autorizado) {
    return <AcessoRestrito />;
  }

  return (
    <div className={`${GRADE_CADASTRO} font-sans`}>
      <section className={CARTAO_FORMULARIO}>
        <h2 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          {editando ? "Alterar usuário" : "Incluir usuário"}
        </h2>
        <form onSubmit={onSubmit} className={`${AREA_ROLAVEL} space-y-3 pr-1`}>
          <input type="hidden" name="id" value={form.id} />
          <label className="block">
            <span className={ROTULO_CAMPO}>Nome</span>
            <input
              name="nome"
              value={form.nome}
              autoComplete="off"
              required
              minLength={3}
              onChange={(event) =>
                setForm((atual) => ({ ...atual, nome: event.target.value }))
              }
              className={CAMPO}
            />
          </label>
          <label className="block">
            <span className={ROTULO_CAMPO}>E-mail</span>
            <input
              name="email"
              type="email"
              value={form.email}
              autoComplete="off"
              required
              onChange={(event) =>
                setForm((atual) => ({ ...atual, email: event.target.value }))
              }
              className={CAMPO}
            />
          </label>
          {editando ? (
            <label className="block">
              <span className={ROTULO_CAMPO}>Senha (opcional)</span>
              <input
                name="senha"
                type="password"
                value={form.senha}
                autoComplete="new-password"
                minLength={6}
                placeholder="Deixe em branco para manter"
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, senha: event.target.value }))
                }
                className={CAMPO}
              />
            </label>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              A senha inicial será <strong>Mudar@123</strong>. No primeiro
              acesso o usuário será obrigado a defini-la.
            </p>
          )}
          <label className="block">
            <span className={ROTULO_CAMPO}>Perfil</span>
            <select
              name="role"
              value={form.role}
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  role: event.target.value as "GESTOR_ADMIN" | "OPERADOR",
                }))
              }
              className={CAMPO}
            >
              <option value="OPERADOR">Usuário</option>
              <option value="GESTOR_ADMIN">Gestor Adm</option>
            </select>
          </label>
          <label className="block">
            <span className={ROTULO_CAMPO}>Status</span>
            <select
              name="ativo"
              value={form.ativo ? "true" : "false"}
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  ativo: event.target.value === "true",
                }))
              }
              className={CAMPO}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </label>
          {ehSuperAdmin ? (
            <label className="block">
              <span className={ROTULO_CAMPO}>Cliente Gestor</span>
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
                className={CAMPO}
              >
                <option value="">Selecione o gestor</option>
                {gestores.map((gestor) => (
                  <option key={gestor.id} value={gestor.id}>
                    {gestor.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {info ? (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
              {info}
            </p>
          ) : null}
          {erro ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={BOTAO_PRIMARIO}>
              {pending
                ? "Salvando..."
                : editando
                  ? "Salvar alterações"
                  : "Incluir usuário"}
            </button>
            {editando ? (
              <button
                type="button"
                disabled={pending}
                onClick={limparFormulario}
                className={BOTAO_SECUNDARIO}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <aside className={CARTAO_LISTA}>
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Usuários cadastrados
        </h3>
        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum usuário incluído.</p>
        ) : (
          <div className={`${AREA_ROLAVEL} min-w-0 overflow-x-hidden rounded-md border border-gray-300`}>
            <table className="w-full table-fixed border-collapse font-sans text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="w-1/3 min-w-0 border border-gray-300 px-3 py-1 text-left text-xs font-semibold text-slate-700">
                    Nome
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left text-xs font-semibold text-slate-700">
                    Perfil
                  </th>
                  {ehSuperAdmin ? (
                    <th className="border border-gray-300 px-3 py-1 text-left text-xs font-semibold text-slate-700">
                      Gestor
                    </th>
                  ) : null}
                  <th className="border border-gray-300 px-3 py-1 text-left text-xs font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center text-xs font-semibold text-slate-700">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      form.id === item.id ? "bg-teal-50/70" : "bg-white"
                    }
                  >
                    <td
                      className="w-1/3 min-w-0 truncate border border-gray-300 px-3 py-1 font-medium text-slate-900"
                      title={toTitleCase(item.nome)}
                    >
                      {toTitleCase(item.nome)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {rotuloRole(item.role)}
                    </td>
                    {ehSuperAdmin ? (
                      <td className="border border-gray-300 px-3 py-1 text-slate-700">
                        {item.gestorNome ? toTitleCase(item.gestorNome) : "—"}
                      </td>
                    ) : null}
                    <td className="border border-gray-300 px-3 py-1">
                      <span
                        className={
                          item.ativo
                            ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                            : "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800"
                        }
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-0 align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-2 py-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => alterar(item)}
                          className="inline-flex h-8 items-center rounded-md bg-sky-400 px-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-sky-500 disabled:opacity-70"
                        >
                          Alterar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => excluir(item)}
                          className="inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-red-700 disabled:opacity-70"
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
      </aside>
    </div>
  );
}
