"use client";

import { FormEvent, useMemo, useState } from "react";
import { maskCelular, toTitleCase } from "@/lib/masks";
import {
  gerarNumerosUnidades,
  TIPOS_CONSUMO,
  TIPOS_UNIDADE,
  type TipoConsumo,
  type TipoUnidade,
} from "@/lib/unidades";

type Condominio = {
  id: string;
  nome: string;
};

type Unidade = {
  id: string;
  numero: string;
  nomeMorador: string;
  celular: string;
  tipoUnidade: string;
  tipoConsumo: string;
  bloco: string;
  condominioId: string;
  condominio: {
    id: string;
    nome: string;
  };
  _count?: {
    leituras: number;
  };
};

type ModoCadastro = "individual" | "lote";

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export default function UnidadeScreen({
  condominiosIniciais,
  unidadesIniciais,
}: {
  condominiosIniciais: Condominio[];
  unidadesIniciais: Unidade[];
}) {
  const [condominios, setCondominios] = useState<Condominio[]>(condominiosIniciais);
  const [unidades, setUnidades] = useState<Unidade[]>(unidadesIniciais);
  const [condominioId, setCondominioId] = useState("");
  const [bloco, setBloco] = useState("");
  const [tipoUnidade, setTipoUnidade] = useState<TipoUnidade>("Apartamento");
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>("Água/Gás");
  const [modo, setModo] = useState<ModoCadastro>("individual");
  const [numero, setNumero] = useState("");
  const [unidadeInicial, setUnidadeInicial] = useState("");
  const [unidadesPorAndar, setUnidadesPorAndar] = useState("");
  const [quantidadeAndares, setQuantidadeAndares] = useState("");
  const [nomeMorador, setNomeMorador] = useState("");
  const [celular, setCelular] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const modoAtual = editandoId ? "individual" : modo;

  async function carregar() {
    const [resCondominios, resUnidades] = await Promise.all([
      fetch("/api/condominios"),
      fetch("/api/unidades"),
    ]);

    const listaCondominios = (await resCondominios.json()) as Condominio[];
    const listaUnidades = (await resUnidades.json()) as Unidade[];

    setCondominios(listaCondominios);
    setUnidades(listaUnidades);
  }

  const unidadesVisiveis = useMemo(() => {
    const filtradas = condominioId
      ? unidades.filter((item) => item.condominioId === condominioId)
      : unidades;

    return [...filtradas].sort((a, b) => {
      const blocoCmp = (a.bloco || "").localeCompare(b.bloco || "", "pt-BR");
      if (blocoCmp !== 0) {
        return blocoCmp;
      }
      return (a.numero || "").localeCompare(b.numero || "", "pt-BR", {
        numeric: true,
      });
    });
  }, [unidades, condominioId]);

  const numerosLote = useMemo(() => {
    const inicial = Number(unidadeInicial);
    const porAndar = Number(unidadesPorAndar);
    const andares = Number(quantidadeAndares);

    if (
      !Number.isInteger(inicial) ||
      !Number.isInteger(porAndar) ||
      !Number.isInteger(andares) ||
      inicial <= 0 ||
      porAndar <= 0 ||
      andares <= 0
    ) {
      return [];
    }

    return gerarNumerosUnidades(inicial, porAndar, andares);
  }, [unidadeInicial, unidadesPorAndar, quantidadeAndares]);

  function limparCamposUnidade() {
    setNumero("");
    setUnidadeInicial("");
    setUnidadesPorAndar("");
    setQuantidadeAndares("");
    setNomeMorador("");
    setCelular("");
    setEditandoId(null);
    setErro("");
    setInfo("");
  }

  function cancelar() {
    limparCamposUnidade();
  }

  function alterar(item: Unidade) {
    setCondominioId(item.condominioId);
    setBloco(item.bloco || "");
    setTipoUnidade(
      TIPOS_UNIDADE.includes(item.tipoUnidade as TipoUnidade)
        ? (item.tipoUnidade as TipoUnidade)
        : "Apartamento",
    );
    setTipoConsumo(
      TIPOS_CONSUMO.includes(item.tipoConsumo as TipoConsumo)
        ? (item.tipoConsumo as TipoConsumo)
        : "Água/Gás",
    );
    setModo("individual");
    setNumero(item.numero);
    setNomeMorador(toTitleCase(item.nomeMorador));
    setCelular(maskCelular(item.celular));
    setEditandoId(item.id);
    setErro("");
    setInfo("");
  }

  async function excluir(item: Unidade) {
    const temLeitura = (item._count?.leituras ?? 0) > 0;

    if (temLeitura) {
      setErro(
        "Não é possível excluir: há leitura vinculada a esta unidade.",
      );
      return;
    }

    if (!confirm("Excluir esta unidade?")) {
      return;
    }

    const response = await fetch(`/api/unidades/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErro(data.error ?? "Não foi possível excluir.");
      return;
    }

    if (editandoId === item.id) {
      cancelar();
    }

    setUnidades((atual) => atual.filter((unidade) => unidade.id !== item.id));
    await carregar();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");
    setSalvando(true);

    try {
      if (modoAtual === "lote") {
        if (numerosLote.length === 0) {
          setErro("Informe unidade inicial, unidades por andar e quantidade de andares.");
          return;
        }

        const criadas: Unidade[] = [];
        let ignoradas = 0;

        for (const numeroLote of numerosLote) {
          const response = await fetch("/api/unidades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              numero: numeroLote,
              nomeMorador: "",
              celular: "",
              tipoUnidade,
              tipoConsumo,
              bloco,
              condominioId,
            }),
          });
          const data = (await response.json()) as Unidade & { error?: string };

          if (response.status === 409) {
            ignoradas += 1;
            continue;
          }

          if (!response.ok) {
            setErro(
              data.error ??
                `Não foi possível incluir a unidade ${numeroLote}.`,
            );
            if (criadas.length > 0) {
              setUnidades((atual) => {
                const ids = new Set(criadas.map((item) => item.id));
                return [...criadas, ...atual.filter((item) => !ids.has(item.id))];
              });
              await carregar();
            }
            return;
          }

          criadas.push(data);
        }

        if (criadas.length === 0) {
          setErro(
            ignoradas > 0
              ? "Todas as unidades deste lote já estão cadastradas neste condomínio."
              : "Não foi possível gerar o lote.",
          );
          return;
        }

        setUnidades((atual) => {
          const ids = new Set(criadas.map((item) => item.id));
          return [...criadas, ...atual.filter((item) => !ids.has(item.id))];
        });
        setInfo(
          ignoradas > 0
            ? `${criadas.length} unidade(s) geradas. ${ignoradas} já existiam e foram ignoradas.`
            : `${criadas.length} unidade(s) geradas no lote (${numerosLote[0]} a ${numerosLote[numerosLote.length - 1]}).`,
        );
        setUnidadeInicial("");
        setUnidadesPorAndar("");
        setQuantidadeAndares("");
        await carregar();
        return;
      }

      const url = editandoId ? `/api/unidades/${editandoId}` : "/api/unidades";
      const response = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          nomeMorador: toTitleCase(nomeMorador),
          celular,
          tipoUnidade,
          tipoConsumo,
          bloco,
          condominioId,
        }),
      });
      const data = (await response.json()) as { error?: string; id?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }

      limparCamposUnidade();
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2 lg:items-start">
      <section className="h-auto min-h-fit rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm">
        <h2 className="text-3xl font-medium text-slate-900">
          {editandoId ? "Alterar unidade" : "Incluir unidade"}
        </h2>
        <p className="mt-1 text-lg text-slate-600">
          Cadastre uma unidade ou gere um lote completo por andar.
        </p>

        <form
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={onSubmit}
        >
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Condomínio
            </span>
            <select
              required
              value={condominioId}
              onChange={(event) => setCondominioId(event.target.value)}
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
              <span className="ml-2 text-base font-normal text-slate-500">
                (facultativo)
              </span>
            </span>
            <input
              value={bloco}
              onChange={(event) => setBloco(event.target.value)}
              className={campoClass}
              placeholder="Bloco A, Torre 2"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Tipo de Unidade
            </span>
            <select
              required
              value={tipoUnidade}
              onChange={(event) =>
                setTipoUnidade(event.target.value as TipoUnidade)
              }
              className={campoClass}
            >
              {TIPOS_UNIDADE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-lg font-medium text-slate-700">
              Tipo de Consumo
            </span>
            <select
              required
              value={tipoConsumo}
              onChange={(event) =>
                setTipoConsumo(event.target.value as TipoConsumo)
              }
              className={campoClass}
            >
              {TIPOS_CONSUMO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          {!editandoId && (
            <fieldset>
              <legend className="mb-1.5 block text-lg font-medium text-slate-700">
                Modo de cadastro
              </legend>
              <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModo("individual")}
                  className={`rounded-lg px-3 py-2.5 text-lg font-medium transition ${
                    modoAtual === "individual"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cadastro Individual
                </button>
                <button
                  type="button"
                  onClick={() => setModo("lote")}
                  className={`rounded-lg px-3 py-2.5 text-lg font-medium transition ${
                    modoAtual === "lote"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cadastro em Bloco (Lote)
                </button>
              </div>
            </fieldset>
          )}

          {modoAtual === "lote" ? (
            <div className="grid grid-cols-1 gap-4 md:col-span-2 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Unidade Inicial
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={unidadeInicial}
                  onChange={(event) => setUnidadeInicial(event.target.value)}
                  className={campoClass}
                  placeholder="101"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Unidades por Andar
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={unidadesPorAndar}
                  onChange={(event) => setUnidadesPorAndar(event.target.value)}
                  className={campoClass}
                  placeholder="4"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Quantidade de Andares
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={quantidadeAndares}
                  onChange={(event) => setQuantidadeAndares(event.target.value)}
                  className={campoClass}
                  placeholder="10"
                />
              </label>
              {numerosLote.length > 0 && (
                <p className="text-base font-medium text-teal-800 sm:col-span-3">
                  Serão geradas {numerosLote.length} unidades:{" "}
                  {numerosLote.slice(0, 8).join(", ")}
                  {numerosLote.length > 8 ? "..." : ""}.
                </p>
              )}
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Nº da unidade
                </span>
                <input
                  required
                  value={numero}
                  onChange={(event) => setNumero(event.target.value)}
                  className={campoClass}
                  placeholder="101"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Nome do Morador
                </span>
                <input
                  required
                  value={nomeMorador}
                  onChange={(event) => setNomeMorador(event.target.value)}
                  className={campoClass}
                  placeholder="Nome completo"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-lg font-medium text-slate-700">
                  Celular
                </span>
                <input
                  required
                  value={celular}
                  onChange={(event) => setCelular(maskCelular(event.target.value))}
                  className={campoClass}
                  placeholder="(00) 00000-0000"
                />
              </label>
            </>
          )}

          {info && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800 md:col-span-2">
              {info}
            </p>
          )}
          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700 md:col-span-2">
              {erro}
            </p>
          )}

          <div className="flex gap-3 md:col-span-2">
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

      <aside className="flex min-h-0 max-h-[calc(100vh-200px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-2xl font-medium text-slate-900">Unidades</h3>
          <button
            type="button"
            onClick={cancelar}
            className="text-lg font-medium text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          {unidadesVisiveis.length === 0 && (
            <p className="text-lg text-slate-500">
              {condominioId
                ? "Nenhuma unidade incluída neste condomínio."
                : "Nenhuma unidade incluída."}
            </p>
          )}

          {unidadesVisiveis.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${
                editandoId === item.id
                  ? "border-teal-600 bg-teal-50/50"
                  : "border-slate-200"
              }`}
            >
              <p className="text-lg font-medium text-slate-900">
                {item.tipoUnidade} {item.numero}
                {item.bloco ? ` • ${item.bloco}` : ""}
              </p>
              <p className="mt-1 text-base font-medium text-slate-500">
                {item.tipoConsumo || "Água/Gás"}
              </p>
              <p className="mt-1 text-lg text-slate-600">{item.condominio.nome}</p>
              {item.nomeMorador ? (
                <p className="mt-1 text-lg text-slate-600">
                  {toTitleCase(item.nomeMorador)}
                </p>
              ) : null}
              {item.celular ? (
                <p className="mt-1 text-lg text-slate-600">
                  {maskCelular(item.celular)}
                </p>
              ) : null}
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
                  disabled={(item._count?.leituras ?? 0) > 0}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-lg font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir
                </button>
                {(item._count?.leituras ?? 0) > 0 ? (
                  <p className="w-full text-base font-medium text-red-700">
                    Exclusão bloqueada: há leitura vinculada a esta unidade.
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
