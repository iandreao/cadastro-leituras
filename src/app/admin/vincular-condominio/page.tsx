"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { AuthFeedback } from "@/components/AuthFeedback";
import AcessoRestrito from "@/components/AcessoRestrito";
import { toTitleCase } from "@/lib/masks";
import {
  carregarPainelVinculo,
  type CondominioVinculavel,
  type GestorDestino,
  type VinculoCondominio,
} from "./actions";
import { VincularCondominioEsqueleto } from "./vincular-esqueleto";

const CARTAO =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm lg:p-8";

const CAMPO =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function rotuloCondominioSelect(condominio: CondominioVinculavel) {
  const gestor = condominio.gestorNome
    ? toTitleCase(condominio.gestorNome)
    : "Órfão / Administradora Master";

  return `${toTitleCase(condominio.nome)} (Gestor: ${gestor})`;
}

export default function VincularCondominioPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [condominios, setCondominios] = useState<CondominioVinculavel[]>([]);
  const [vinculos, setVinculos] = useState<VinculoCondominio[]>([]);
  const [gestores, setGestores] = useState<GestorDestino[]>([]);
  const [condominioId, setCondominioId] = useState("");
  const [novoGestorId, setNovoGestorId] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    const painel = await carregarPainelVinculo();

    if (!painel.autorizado) {
      setAutorizado(false);
      return;
    }

    setCondominios(painel.condominios);
    setVinculos(painel.vinculos);
    setGestores(painel.gestores);
    setAutorizado(true);
  }

  const condominioSelecionado = useMemo(
    () => condominios.find((item) => item.id === condominioId) ?? null,
    [condominioId, condominios],
  );

  const gestoresDestino = useMemo(
    () =>
      gestores.filter((gestor) => gestor.id !== condominioSelecionado?.gestorId),
    [condominioSelecionado, gestores],
  );

  const podeConfirmar = Boolean(condominioId && novoGestorId) && !pending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    if (!condominioId || !novoGestorId) {
      setErro("Selecione o condomínio e o gestor de destino.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/vincular-condominio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condominioId, novoGestorId }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

        if (!response.ok || data.error) {
          setErro(data.error ?? "Não foi possível transferir o condomínio.");
          return;
        }

        setSucesso(
          "Transferência concluída. O condomínio e o histórico passaram para a nova administradora.",
        );
        setCondominioId("");
        setNovoGestorId("");
        await carregar();
      } catch {
        setErro("Não foi possível transferir o condomínio. Tente novamente.");
      }
    });
  }

  if (autorizado === null) {
    return <VincularCondominioEsqueleto />;
  }

  if (!autorizado) {
    return <AcessoRestrito />;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="mb-2 shrink-0 text-2xl font-medium text-slate-900">
          Condomínio - Vínculo Atual
        </h2>
        <p className="mb-6 shrink-0 text-lg text-slate-600">
          Vincule condomínios órfãos ou transfira um condomínio de um gestor
          para outro, sem perder seu histórico de leituras e despesas
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Condomínio
            </span>
            <select
              value={condominioId}
              onChange={(event) => {
                setCondominioId(event.target.value);
                setNovoGestorId("");
                setErro("");
                setSucesso("");
              }}
              className={CAMPO}
            >
              <option value="">Selecione o condomínio</option>
              {condominios.map((condominio) => (
                <option key={condominio.id} value={condominio.id}>
                  {rotuloCondominioSelect(condominio)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Novo gestor / cliente
            </span>
            <select
              value={novoGestorId}
              onChange={(event) => {
                setNovoGestorId(event.target.value);
                setErro("");
                setSucesso("");
              }}
              disabled={!condominioId}
              className={`${CAMPO} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
            >
              <option value="">
                {condominioId
                  ? "Selecione o gestor de destino"
                  : "Escolha o condomínio primeiro"}
              </option>
              {gestoresDestino.map((gestor) => (
                <option key={gestor.id} value={gestor.id}>
                  {toTitleCase(gestor.nome)}
                  {gestor.ativo ? "" : " (inativo)"}
                </option>
              ))}
            </select>
          </label>

          {sucesso ? (
            <AuthFeedback
              tipo="sucesso"
              titulo="Transferência confirmada"
              mensagem={sucesso}
            />
          ) : null}
          {erro ? (
            <AuthFeedback
              tipo="erro"
              titulo="Não foi possível transferir"
              mensagem={erro}
            />
          ) : null}

          <button
            type="submit"
            disabled={!podeConfirmar}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Transferindo..." : "Confirmar Transferência"}
          </button>
        </form>
      </section>

      <section className={CARTAO}>
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h3 className="text-2xl font-medium text-slate-900">
            Vínculos Atuais de Condomínios
          </h3>
          <span className="shrink-0 text-sm font-medium text-slate-500">
            {vinculos.length}
          </span>
        </div>

        {vinculos.length === 0 ? (
          <p className="text-lg text-slate-500">
            Nenhum condomínio cadastrado.
          </p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto pr-2">
            <table className="min-w-full border-collapse text-lg">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium text-slate-700">
                    Condomínio
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium text-slate-700">
                    Gestor / Administradora
                  </th>
                </tr>
              </thead>
              <tbody>
                {vinculos.map((item) => (
                  <tr
                    key={item.id}
                    className="bg-white transition hover:bg-slate-50/80"
                  >
                    <td className="border-t border-slate-200 px-3 py-2.5 font-medium text-slate-900">
                      {toTitleCase(item.nome)}
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2.5 text-right">
                      {item.gestorNome ? (
                        <span className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-base font-medium text-teal-900">
                          {toTitleCase(item.gestorNome)}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-base font-medium text-red-800">
                          Órfão / Administradora Master
                        </span>
                      )}
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
