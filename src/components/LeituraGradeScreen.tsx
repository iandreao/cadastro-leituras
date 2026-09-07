"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { nomeBloco } from "@/lib/blocos";
import { usePublicarCondominio } from "@/lib/condominio-selecionado";
import { toTitleCase } from "@/lib/masks";
import {
  anosReferencia,
  consumoGasInconsistente,
  consumoM3,
  formatarLeitura,
  leituraMenorQueAnterior,
  mascararLeitura,
  MESES,
  mensagemConsumoGasInconsistente,
  mensagemLeituraMenorQueAnterior,
  parseLeituraDigitada,
  periodoMenor,
  rotuloUnidade,
  unidadeElegivelPara,
  valorLeituraDoTipo,
} from "@/lib/leituras";

type TipoLeituraTela = "agua" | "gas";

type Condominio = {
  id: string;
  nome: string;
};

type Unidade = {
  id: string;
  numero: string;
  bloco: string | { nome: string };
  tipoUnidade: { id: string; nome: string };
  tipoConsumo: string;
  condominioId: string;
};

type Leitura = {
  unidadeId: string;
  mes: number;
  ano: number;
  valorAgua: number | null;
  valorGas: number | null;
};

type Linha = {
  unidade: Unidade;
  elegivel: boolean;
  anterior: number;
};

const campoClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const inputTabela =
  "w-full rounded-md border border-slate-300 px-2 py-2 text-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

const inputErro =
  "w-full rounded-md border border-red-600 bg-red-50 px-2 py-2 text-lg text-red-800 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20";

const inputBloqueado =
  "w-full cursor-not-allowed rounded-md border border-slate-400 bg-slate-300 px-2 py-2 text-lg text-slate-600 pointer-events-none dark:bg-slate-700 dark:text-slate-300";

const agora = new Date();
const anos = anosReferencia(agora.getFullYear());

function leituraAnteriorDaUnidade(
  leituras: Leitura[],
  unidadeId: string,
  mes: number,
  ano: number,
  tipo: TipoLeituraTela,
) {
  const anteriores = leituras
    .filter(
      (item) =>
        String(item.unidadeId) === String(unidadeId) &&
        periodoMenor(item.ano, item.mes, ano, mes) &&
        valorLeituraDoTipo(item, tipo) != null,
    )
    .sort((a, b) => b.ano - a.ano || b.mes - a.mes);

  return anteriores[0] ? (valorLeituraDoTipo(anteriores[0], tipo) ?? 0) : 0;
}

function leituraAtualExistente(
  leituras: Leitura[],
  unidadeId: string,
  mes: number,
  ano: number,
  tipo: TipoLeituraTela,
) {
  const atual = leituras.find(
    (item) =>
      String(item.unidadeId) === String(unidadeId) &&
      item.mes === mes &&
      item.ano === ano,
  );

  const valor = atual ? valorLeituraDoTipo(atual, tipo) : null;
  return valor == null ? "" : formatarLeitura(valor);
}

export default function LeituraGradeScreen({
  tipo,
  condominios,
}: {
  tipo: TipoLeituraTela;
  condominios: Condominio[];
}) {
  const titulo =
    tipo === "agua" ? "Inserir Leitura de Água" : "Inserir Leitura de Gás";
  const [condominioId, setCondominioId] = useState("");
  const [mes, setMes] = useState(String(agora.getMonth() + 1));
  const [ano, setAno] = useState(String(agora.getFullYear()));
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [atuais, setAtuais] = useState<Record<string, string>>({});
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  usePublicarCondominio(condominioId, condominios);

  const mesNumero = Number(mes);
  const anoNumero = Number(ano);

  useEffect(() => {
    if (!condominioId) {
      setUnidades([]);
      setLeituras([]);
      setAtuais({});
      setErrosLinha({});
      return;
    }

    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      setInfo("");

      try {
        const [resUnidades, resLeituras] = await Promise.all([
          fetch(`/api/unidades?condominioId=${condominioId}`),
          fetch(`/api/leituras?condominioId=${condominioId}`),
        ]);
        const listaUnidades = (await resUnidades.json()) as Unidade[];
        const listaLeituras = (await resLeituras.json()) as Leitura[];

        if (!ativo) {
          return;
        }

        const ordenadas = [...listaUnidades].sort((a, b) => {
          const bloco = nomeBloco(a.bloco).localeCompare(nomeBloco(b.bloco), "pt-BR");
          if (bloco !== 0) {
            return bloco;
          }
          return (a.numero || "").localeCompare(b.numero || "", "pt-BR", {
            numeric: true,
          });
        });

        const preenchidos: Record<string, string> = {};
        for (const unidade of ordenadas) {
          preenchidos[unidade.id] = leituraAtualExistente(
            listaLeituras,
            unidade.id,
            mesNumero,
            anoNumero,
            tipo,
          );
        }

        setUnidades(ordenadas);
        setLeituras(listaLeituras);
        setAtuais(preenchidos);
        setErrosLinha({});
      } catch {
        if (ativo) {
          setErro("Não foi possível carregar as unidades do condomínio.");
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [condominioId, mesNumero, anoNumero, tipo]);

  const linhas: Linha[] = useMemo(
    () =>
      unidades.map((unidade) => ({
        unidade,
        elegivel: unidadeElegivelPara(unidade.tipoConsumo, tipo),
        anterior: leituraAnteriorDaUnidade(
          leituras,
          unidade.id,
          mesNumero,
          anoNumero,
          tipo,
        ),
      })),
    [unidades, leituras, mesNumero, anoNumero, tipo],
  );

  function limparErroLinha(unidadeId: string) {
    setErrosLinha((atual) => {
      if (!atual[unidadeId]) {
        return atual;
      }

      const proximo = { ...atual };
      delete proximo[unidadeId];
      return proximo;
    });
  }

  function validarLeituraCampo(
    unidadeId: string,
    valorDigitado: string,
    anterior: number,
    rotulo: string,
  ) {
    const bruto = valorDigitado.trim();

    if (!bruto) {
      limparErroLinha(unidadeId);
      return { ok: true, valor: null as number | null };
    }

    const valor = parseLeituraDigitada(bruto, anterior);

    if (Number.isNaN(valor) || valor < 0) {
      setErrosLinha((atual) => ({
        ...atual,
        [unidadeId]: "Informe uma leitura válida.",
      }));
      return { ok: false, valor: null as number | null };
    }

    if (leituraMenorQueAnterior(valor, anterior)) {
      const mensagem = mensagemLeituraMenorQueAnterior(rotulo, anterior, tipo);
      setErrosLinha((atual) => ({ ...atual, [unidadeId]: mensagem }));
      return { ok: false, valor };
    }

    limparErroLinha(unidadeId);
    return { ok: true, valor };
  }

  function atualizarAtual(
    unidadeId: string,
    valor: string,
    anterior: number,
    rotulo: string,
  ) {
    const mascarado = mascararLeitura(valor);
    setAtuais((atual) => ({ ...atual, [unidadeId]: mascarado }));
    validarLeituraCampo(unidadeId, mascarado, anterior, rotulo);
    setErro("");
    setInfo("");
  }

  function confirmarAtual(
    unidadeId: string,
    valor: string,
    anterior: number,
    rotulo: string,
  ) {
    const bruto = valor.trim();

    if (!bruto) {
      setAtuais((atual) => ({ ...atual, [unidadeId]: "" }));
      limparErroLinha(unidadeId);
      return;
    }

    const { ok, valor: numero } = validarLeituraCampo(
      unidadeId,
      bruto,
      anterior,
      rotulo,
    );

    if (numero == null || Number.isNaN(numero)) {
      setAtuais((atual) => ({ ...atual, [unidadeId]: "" }));
      return;
    }

    setAtuais((atual) => ({ ...atual, [unidadeId]: formatarLeitura(numero) }));

    if (!ok) {
      setErro(mensagemLeituraMenorQueAnterior(rotulo, anterior, tipo));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setInfo("");

    if (!condominioId) {
      setErro("Selecione o condomínio.");
      return;
    }

    const inconsistentes: string[] = [];
    const itens: { unidadeId: string; valor: number }[] = [];
    const errosSubmit: Record<string, string> = {};

    for (const linha of linhas) {
      if (!linha.elegivel) {
        continue;
      }

      const rotulo = rotuloUnidade(linha.unidade);
      const bruto = (atuais[linha.unidade.id] ?? "").trim();

      if (!bruto) {
        continue;
      }

      const valor = parseLeituraDigitada(bruto, linha.anterior);

      if (Number.isNaN(valor) || valor < 0) {
        errosSubmit[linha.unidade.id] = "Informe uma leitura válida.";
        inconsistentes.push(rotulo);
        continue;
      }

      if (leituraMenorQueAnterior(valor, linha.anterior)) {
        const mensagem = mensagemLeituraMenorQueAnterior(
          rotulo,
          linha.anterior,
          tipo,
        );
        errosSubmit[linha.unidade.id] = mensagem;
        inconsistentes.push(rotulo);
        continue;
      }

      if (tipo === "gas") {
        const consumo = consumoM3(valor, linha.anterior);

        if (consumoGasInconsistente(consumo)) {
          setErro(
            mensagemConsumoGasInconsistente(rotulo, consumo),
          );
          return;
        }
      }

      itens.push({ unidadeId: linha.unidade.id, valor });
    }

    if (inconsistentes.length > 0) {
      setErrosLinha((atual) => ({ ...atual, ...errosSubmit }));
      setErro(
        inconsistentes.length === 1
          ? Object.values(errosSubmit)[0]
          : `A leitura atual não pode ser menor que a anterior na(s) unidade(s): ${inconsistentes.join(", ")}.`,
      );
      return;
    }

    if (itens.length === 0) {
      setErro("Preencha a leitura atual de ao menos uma unidade elegível.");
      return;
    }

    setSalvando(true);

    try {
      const response = await fetch("/api/leituras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId,
          mes: mesNumero,
          ano: anoNumero,
          tipo,
          itens,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível salvar as leituras.");
        return;
      }

      setInfo(`${itens.length} leitura(s) salvas com sucesso.`);
      setErrosLinha({});
      const resLeituras = await fetch(`/api/leituras?condominioId=${condominioId}`);
      setLeituras((await resLeituras.json()) as Leitura[]);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto h-auto min-h-fit max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm"
    >
      <h2 className="text-3xl font-medium text-slate-900">{titulo}</h2>
      <p className="mt-1 text-lg text-slate-600">
        Selecione o condomínio e a referência. A tabela lista todas as unidades
        para preenchimento em lote.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="block lg:col-span-1">
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
                {toTitleCase(item.nome)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-lg font-medium text-slate-700">
            Mês
          </span>
          <select
            required
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className={campoClass}
          >
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
            onChange={(event) => setAno(event.target.value)}
            className={campoClass}
          >
            {anos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] bg-slate-100 px-4 py-3 text-lg font-medium text-slate-800">
          <span>Unidade</span>
          <span>Leitura Anterior</span>
          <span>Leitura Atual</span>
        </div>

        <div className="max-h-[540px] overflow-y-auto">
          {!condominioId && (
            <p className="px-4 py-8 text-center text-lg text-slate-500">
              Selecione o condomínio para listar as unidades.
            </p>
          )}
          {condominioId && carregando && (
            <p className="px-4 py-8 text-center text-lg text-slate-500">
              Carregando unidades...
            </p>
          )}
          {condominioId && !carregando && linhas.length === 0 && (
            <p className="px-4 py-8 text-center text-lg text-slate-500">
              Nenhuma unidade cadastrada neste condomínio.
            </p>
          )}
          {!carregando &&
            linhas.map((linha, indice) => {
              const bloqueada = !linha.elegivel;
              const rotulo = rotuloUnidade(linha.unidade);
              const erroLinha = errosLinha[linha.unidade.id];

              return (
                <div
                  key={linha.unidade.id}
                  className={`border-b border-slate-200 px-4 py-2 ${
                    indice % 2 === 0 ? "bg-white" : "bg-slate-50"
                  }`}
                >
                  <div className="grid min-h-[60px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                  <span className="text-lg font-medium text-slate-800">
                    {rotulo}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    readOnly
                    disabled
                    value={
                      bloqueada ? "" : formatarLeitura(linha.anterior)
                    }
                    className={bloqueada ? inputBloqueado : inputTabela}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={bloqueada}
                    aria-invalid={Boolean(erroLinha)}
                    value={bloqueada ? "" : (atuais[linha.unidade.id] ?? "")}
                    onChange={(event) =>
                      atualizarAtual(
                        linha.unidade.id,
                        event.target.value,
                        linha.anterior,
                        rotulo,
                      )
                    }
                    onBlur={(event) =>
                      confirmarAtual(
                        linha.unidade.id,
                        event.target.value,
                        linha.anterior,
                        rotulo,
                      )
                    }
                    className={
                      bloqueada
                        ? inputBloqueado
                        : erroLinha
                          ? inputErro
                          : inputTabela
                    }
                    placeholder={bloqueada ? "" : "0,000"}
                  />
                  </div>
                  {erroLinha && (
                    <p className="mt-1 text-base font-medium text-red-700">
                      {erroLinha}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
          {erro}
        </p>
      )}
      {info && (
        <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800">
          {info}
        </p>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="submit"
          disabled={
            salvando ||
            !condominioId ||
            carregando ||
            Object.keys(errosLinha).length > 0
          }
          className="rounded-xl bg-blue-600 px-16 py-3 text-xl font-semibold tracking-wide text-white uppercase hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
