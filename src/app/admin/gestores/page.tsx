"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";
import {
  isValidCpf,
  maskCelular,
  maskCep,
  maskCnpj,
  maskCpf,
  onlyDigits,
  toTitleCase,
} from "@/lib/masks";
import AcessoRestrito from "@/components/AcessoRestrito";
import {
  alternarAtivoGestor,
  excluirGestor,
  listarGestores,
  obterPerfilAdmin,
  salvarGestor,
  type GestorLista,
} from "./actions";

type TipoPessoa = "FISICA" | "JURIDICA";

function formularioVazio() {
  return {
    id: "",
    tipoPessoa: "JURIDICA" as TipoPessoa,
    documento: "",
    nome: "",
    email: "",
    celular: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  };
}

function gestorParaForm(item: GestorLista) {
  const tipoPessoa: TipoPessoa =
    item.tipoPessoa === "FISICA" ? "FISICA" : "JURIDICA";

  return {
    id: item.id,
    tipoPessoa,
    documento:
      tipoPessoa === "FISICA"
        ? maskCpf(item.documento ?? "")
        : maskCnpj(item.documento ?? ""),
    nome: item.nome ?? item.razaoSocial ?? "",
    email: item.email ?? "",
    celular: maskCelular(item.celular ?? ""),
    cep: maskCep(item.cep ?? ""),
    logradouro: item.logradouro ?? "",
    numero: item.numero ?? "",
    complemento: item.complemento ?? "",
    bairro: item.bairro ?? "",
    cidade: item.cidade ?? "",
    estado: item.estado ?? "",
  };
}

export default function GestoresPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [lista, setLista] = useState<GestorLista[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [erroCpf, setErroCpf] = useState("");
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [ultimoCnpjConsultado, setUltimoCnpjConsultado] = useState("");
  const [ultimoCepConsultado, setUltimoCepConsultado] = useState("");
  const [pending, startTransition] = useTransition();
  const tipoPessoaRef = useRef(form.tipoPessoa);
  tipoPessoaRef.current = form.tipoPessoa;
  const ehCpf = form.tipoPessoa === "FISICA";
  const cpfValido = !ehCpf || isValidCpf(form.documento);
  const editando = Boolean(form.id);

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

  function limparFormulario() {
    setForm(formularioVazio());
    setErro("");
    setErroCpf("");
    setInfo("");
    setUltimoCnpjConsultado("");
    setUltimoCepConsultado("");
    setConsultandoCnpj(false);
    setConsultandoCep(false);
  }

  function escolherTipo(proximo: TipoPessoa) {
    if (editando || proximo === form.tipoPessoa) {
      return;
    }

    setForm((atual) => ({
      ...formularioVazio(),
      tipoPessoa: proximo,
      email: atual.email,
      celular: atual.celular,
    }));
    setUltimoCnpjConsultado("");
    setUltimoCepConsultado("");
    setConsultandoCnpj(false);
    setErro("");
    setErroCpf("");
    setInfo("");
  }

  function validarCpfDigitado(valor: string) {
    const digits = onlyDigits(valor);

    if (digits.length < 11) {
      setErroCpf("");
      return;
    }

    setErroCpf(isValidCpf(valor) ? "" : "CPF inválido.");
  }

  async function consultarCnpj(cnpjValue: string) {
    if (tipoPessoaRef.current !== "JURIDICA") {
      return;
    }

    const digits = onlyDigits(cnpjValue);

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
        email?: string;
        celular?: string;
        cep?: string;
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        estado?: string;
        error?: string;
      };

      if (tipoPessoaRef.current !== "JURIDICA") {
        return;
      }

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível validar o CNPJ.");
        return;
      }

      setForm((atual) => {
        if (onlyDigits(atual.documento) !== digits) {
          return atual;
        }

        return {
          ...atual,
          nome: toTitleCase(data.nome ?? atual.nome),
          email: data.email || atual.email,
          celular: data.celular ? maskCelular(data.celular) : atual.celular,
          cep: data.cep ? maskCep(data.cep) : atual.cep,
          logradouro: data.logradouro || atual.logradouro,
          numero: data.numero || atual.numero,
          complemento: data.complemento || atual.complemento,
          bairro: data.bairro || atual.bairro,
          cidade: data.cidade || atual.cidade,
          estado: data.estado || atual.estado,
        };
      });
      setUltimoCnpjConsultado(digits);
      setInfo(
        "CNPJ validado na Receita Federal. Nome e endereço preenchidos.",
      );
    } catch {
      setErro("Falha ao consultar a Receita Federal.");
    } finally {
      setConsultandoCnpj(false);
    }
  }

  async function consultarCep(cepValue: string) {
    const digits = onlyDigits(cepValue);

    if (digits.length !== 8 || digits === ultimoCepConsultado) {
      return;
    }

    setConsultandoCep(true);
    setErro("");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        complemento?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (data.erro) {
        setErro("CEP não encontrado.");
        return;
      }

      setForm((atual) => {
        if (onlyDigits(atual.cep) !== digits) {
          return atual;
        }

        return {
          ...atual,
          logradouro: toTitleCase(data.logradouro ?? atual.logradouro),
          complemento: data.complemento
            ? toTitleCase(data.complemento)
            : atual.complemento,
          bairro: toTitleCase(data.bairro ?? atual.bairro),
          cidade: toTitleCase(data.localidade ?? atual.cidade),
          estado: (data.uf ?? atual.estado).toUpperCase(),
        };
      });
      setUltimoCepConsultado(digits);
    } catch {
      setErro("Falha ao consultar o CEP.");
    } finally {
      setConsultandoCep(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setInfo("");

    if (ehCpf && !isValidCpf(form.documento)) {
      setErroCpf("CPF inválido.");
      setErro("Informe um CPF válido.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const resultado = await salvarGestor(formData);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      limparFormulario();
      setInfo(editando ? "Gestor atualizado com sucesso." : "Gestor cadastrado com sucesso.");
      setLista(await listarGestores());
    });
  }

  function alterar(item: GestorLista) {
    setForm(gestorParaForm(item));
    setErro("");
    setErroCpf("");
    setInfo("");
    setUltimoCnpjConsultado(onlyDigits(item.documento ?? ""));
    setUltimoCepConsultado(onlyDigits(item.cep ?? ""));
  }

  function alternar(item: GestorLista) {
    setErro("");
    setInfo("");
    startTransition(async () => {
      const resultado = await alternarAtivoGestor(item.id);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      setInfo(item.ativo ? "Gestor inativado." : "Gestor ativado.");
      setLista(await listarGestores());
    });
  }

  function excluir(item: GestorLista) {
    if (
      !window.confirm(
        `Excluir o gestor "${toTitleCase(item.nome)}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setErro("");
    setInfo("");
    startTransition(async () => {
      const resultado = await excluirGestor(item.id);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      if (form.id === item.id) {
        limparFormulario();
      }

      setInfo("Gestor excluído.");
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
          {editando ? "Alterar gestor" : "Incluir gestor"}
        </h2>
        <form onSubmit={onSubmit} className={`${AREA_ROLAVEL} space-y-4 pr-1`}>
          {editando ? <input type="hidden" name="id" value={form.id} /> : null}
          <input type="hidden" name="tipoPessoa" value={form.tipoPessoa} />

          <fieldset>
            <legend className="mb-1.5 text-lg font-medium text-slate-700">
              Tipo de pessoa
            </legend>
            <div className="flex gap-2">
              {(
                [
                  { valor: "JURIDICA" as const, rotulo: "Pessoa jurídica" },
                  { valor: "FISICA" as const, rotulo: "Pessoa física" },
                ]
              ).map((opcao) => {
                const ativo = form.tipoPessoa === opcao.valor;

                return (
                  <label
                    key={opcao.valor}
                    className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-base font-medium ${
                      ativo
                        ? "border-teal-700 bg-teal-700 text-white"
                        : `border-slate-300 bg-white text-slate-700 ${
                            editando ? "opacity-60" : "hover:bg-slate-50"
                          }`
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoPessoaUi"
                      value={opcao.valor}
                      checked={ativo}
                      disabled={editando}
                      onChange={() => escolherTipo(opcao.valor)}
                      className="sr-only"
                    />
                    {opcao.rotulo}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              {ehCpf ? "CPF" : "CNPJ"}
            </span>
            <input
              name="documento"
              value={form.documento}
              autoComplete="off"
              inputMode="numeric"
              required
              placeholder={ehCpf ? "000.000.000-00" : "00.000.000/0000-00"}
              onChange={(event) => {
                const valor = ehCpf
                  ? maskCpf(event.target.value)
                  : maskCnpj(event.target.value);
                setForm((atual) => ({ ...atual, documento: valor }));
                if (ehCpf) {
                  validarCpfDigitado(valor);
                }
              }}
              onBlur={(event) => {
                if (!ehCpf) {
                  void consultarCnpj(event.target.value);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            {ehCpf && erroCpf ? (
              <p className="mt-1.5 text-lg text-red-700">{erroCpf}</p>
            ) : null}
          </label>
          {consultandoCnpj && !ehCpf ? (
            <p className="text-lg font-medium text-teal-700">
              Consultando Receita Federal...
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              {ehCpf ? "Nome" : "Nome / Razão social"}
            </span>
            <input
              name="nome"
              value={form.nome}
              autoComplete="off"
              required
              disabled={!cpfValido}
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  nome: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="block md:col-span-3">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Logradouro
              </span>
              <input
                name="logradouro"
                value={form.logradouro}
                autoComplete="off"
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    logradouro: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
            <label className="block md:col-span-1">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Número
              </span>
              <input
                name="numero"
                value={form.numero}
                autoComplete="off"
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, numero: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Complemento
              </span>
              <input
                name="complemento"
                value={form.complemento}
                autoComplete="off"
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    complemento: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Bairro
              </span>
              <input
                name="bairro"
                value={form.bairro}
                autoComplete="off"
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, bairro: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                Cidade
              </span>
              <input
                name="cidade"
                value={form.cidade}
                autoComplete="off"
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, cidade: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
            <label className="block md:col-span-1">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                UF
              </span>
              <input
                name="estado"
                value={form.estado}
                autoComplete="off"
                maxLength={2}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    estado: event.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-lg font-medium text-slate-700">
                CEP
              </span>
              <input
                name="cep"
                value={form.cep}
                autoComplete="off"
                inputMode="numeric"
                placeholder="00000-000"
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    cep: maskCep(event.target.value),
                  }))
                }
                onBlur={(event) => void consultarCep(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
          </div>
          {consultandoCep ? (
            <p className="text-lg font-medium text-teal-700">Consultando CEP...</p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                Celular
              </span>
              <input
                name="celular"
                value={form.celular}
                autoComplete="off"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    celular: maskCelular(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
          </div>

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

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || (ehCpf && !cpfValido)}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-lg font-medium text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {pending
                ? "Salvando..."
                : editando
                  ? "Salvar alterações"
                  : "Incluir gestor"}
            </button>
            {editando ? (
              <button
                type="button"
                disabled={pending}
                onClick={limparFormulario}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-lg font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            ) : null}
          </div>
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
                    Nome / Razão social
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                    Status
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-medium text-slate-700">
                    Ações
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
                    <td className="border border-gray-300 px-3 py-1 font-medium text-slate-900">
                      {toTitleCase(item.nome)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-slate-700">
                      {item.ativo ? "Ativo" : "Inativo"}
                    </td>
                    <td className="border border-gray-300 p-0 align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-2 py-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => alterar(item)}
                          className="rounded-md bg-sky-400 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-sky-500"
                        >
                          Alterar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => alternar(item)}
                          className="rounded-md bg-slate-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-slate-700"
                        >
                          {item.ativo ? "Inativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => excluir(item)}
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
      </aside>
    </div>
  );
}
