"use client";

import { FormEvent, useState } from "react";
import { maskCelular, maskCnpj, toTitleCase } from "@/lib/masks";

type Condominio = {
  id: string;
  cnpj: string;
  nome: string;
  endereco: string;
  email: string;
  celular: string;
  temLeitura?: boolean;
};

const vazio = {
  cnpj: "",
  nome: "",
  endereco: "",
  email: "",
  celular: "",
};

export default function CondominioScreen({
  inicial,
}: {
  inicial: Condominio[];
}) {
  const [form, setForm] = useState(vazio);
  const [lista, setLista] = useState<Condominio[]>(inicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ultimoCnpjConsultado, setUltimoCnpjConsultado] = useState("");

  const titulo = editandoId ? "Alterar condomínio" : "Incluir condomínio";

  async function carregar() {
    const response = await fetch("/api/condominios");
    const data = (await response.json()) as Condominio[];
    setLista(data);
  }

  async function consultarCnpj(cnpjValue: string) {
    const digits = cnpjValue.replace(/\D/g, "");

    if (digits.length !== 14 || digits === ultimoCnpjConsultado) {
      return;
    }

    setConsultandoCnpj(true);
    setErro("");
    setInfo("");

    try {
      const response = await fetch(`/api/cnpj/${digits}`);
      const data = (await response.json()) as {
        nome?: string;
        endereco?: string;
        error?: string;
      };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível validar o CNPJ.");
        return;
      }

      setForm((atual) => ({
        ...atual,
        nome: toTitleCase(data.nome ?? atual.nome),
        endereco: toTitleCase(data.endereco ?? atual.endereco),
      }));
      setUltimoCnpjConsultado(digits);
      setInfo("CNPJ validado na Receita Federal. Nome e endereço preenchidos.");
    } catch {
      setErro("Falha ao consultar a Receita Federal.");
    } finally {
      setConsultandoCnpj(false);
    }
  }

  function onCnpjChange(value: string) {
    const mascarado = maskCnpj(value);
    setForm((atual) => ({ ...atual, cnpj: mascarado }));
    void consultarCnpj(mascarado);
  }

  function cancelar() {
    setForm(vazio);
    setEditandoId(null);
    setErro("");
    setInfo("");
    setUltimoCnpjConsultado("");
  }

  function alterar(item: Condominio) {
    setForm({
      cnpj: maskCnpj(item.cnpj),
      nome: toTitleCase(item.nome),
      endereco: toTitleCase(item.endereco),
      email: item.email,
      celular: maskCelular(item.celular),
    });
    setEditandoId(item.id);
    setUltimoCnpjConsultado(item.cnpj);
    setErro("");
    setInfo("");
  }

  async function excluir(item: Condominio) {
    if (item.temLeitura) {
      setErro(
        "Não é possível excluir: há leitura vinculada a unidade deste condomínio.",
      );
      return;
    }

    if (!confirm("Excluir este condomínio?")) {
      return;
    }

    const response = await fetch(`/api/condominios/${item.id}`, {
      method: "DELETE",
    });
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
    setSalvando(true);

    try {
      const url = editandoId
        ? `/api/condominios/${editandoId}`
        : "/api/condominios";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nome: toTitleCase(form.nome),
          endereco: toTitleCase(form.endereco),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }

      cancelar();
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm">
        <h2 className="text-3xl font-medium text-slate-900">{titulo}</h2>
        <p className="mt-1 text-lg text-slate-600">
          O CNPJ é consultado na Receita Federal ao completar 14 dígitos.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Campo
            label="CNPJ"
            value={form.cnpj}
            onChange={onCnpjChange}
            placeholder="00.000.000/0000-00"
          />
          {consultandoCnpj && (
            <p className="text-lg font-medium text-teal-700">
              Consultando Receita Federal...
            </p>
          )}
          <Campo
            label="Nome"
            value={form.nome}
            onChange={(value) => setForm((atual) => ({ ...atual, nome: value }))}
          />
          <Campo
            label="Endereço"
            value={form.endereco}
            onChange={(value) =>
              setForm((atual) => ({ ...atual, endereco: value }))
            }
          />
          <Campo
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(value) => setForm((atual) => ({ ...atual, email: value }))}
          />
          <Campo
            label="Celular"
            value={form.celular}
            onChange={(value) =>
              setForm((atual) => ({ ...atual, celular: maskCelular(value) }))
            }
            placeholder="(00) 00000-0000"
          />

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

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-h-[calc(100vh-200px)]">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-2xl font-medium text-slate-900">Condomínios</h3>
          <button
            type="button"
            onClick={cancelar}
            className="text-lg font-medium text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          {lista.length === 0 && (
            <p className="text-lg text-slate-500">Nenhum condomínio incluído.</p>
          )}

          {lista.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${
                editandoId === item.id
                  ? "border-teal-600 bg-teal-50/50"
                  : "border-slate-200"
              }`}
            >
              <p className="text-lg font-medium text-slate-900">
                {toTitleCase(item.nome)}
              </p>
              <p className="mt-1 text-lg text-slate-600">{maskCnpj(item.cnpj)}</p>
              <p className="mt-1 text-lg text-slate-600">
                {toTitleCase(item.endereco)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => alterar(item)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-lg font-medium text-white"
                >
                  Alterar
                </button>
                <button
                  type="button"
                  onClick={() => void excluir(item)}
                  disabled={Boolean(item.temLeitura)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-lg font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir
                </button>
                {item.temLeitura ? (
                  <p className="w-full text-base font-medium text-red-700">
                    Exclusão bloqueada: há leitura vinculada a unidade deste condomínio.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={cancelar}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-lg font-medium text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-lg font-medium text-slate-700">
        {label}
      </span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
  );
}
