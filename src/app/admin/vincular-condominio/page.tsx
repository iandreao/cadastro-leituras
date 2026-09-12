"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { AuthFeedback } from "@/components/AuthFeedback";
import AcessoRestrito from "@/components/AcessoRestrito";
import { AREA_ROLAVEL } from "@/lib/layout-cadastro";
import { toTitleCase } from "@/lib/masks";
import {
  carregarPainelVinculo,
  type CondominioVinculavel,
  type GestorDestino,
  type VinculoCondominio,
} from "./actions";
import { VincularCondominioEsqueleto } from "./vincular-esqueleto";

const GRADE_VINCULO = "grid w-full grid-cols-1 gap-6 lg:grid-cols-12";

const CARTAO =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm lg:p-10";

const CAMPO =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

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
    <div className={GRADE_VINCULO}>
      <section className={`${CARTAO} lg:col-span-7`}>
        <h2 className="mb-2 shrink-0 text-2xl font-medium text-slate-900">
          Vincular condomínio
        </h2>
        <p className="mb-6 shrink-0 text-lg text-slate-600">
          Transfira um condomínio órfão ou da Administradora Master para um
          gestor cliente, sem perder leituras nem despesas.
        </p>

        <form onSubmit={onSubmit} className={`${AREA_ROLAVEL} space-y-5 pr-1`}>
          <label className="block">
            <span className="mb-1 block text-lg font-medium text-slate-700">
              Condomínio órfão / existente
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
                  {toTitleCase(condominio.nome)}
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

      <aside className={`${CARTAO} lg:col-span-5`}>
        <h3 className="mb-4 shrink-0 text-2xl font-medium text-slate-900">
          Atenção
        </h3>
        <div className={`${AREA_ROLAVEL} space-y-5 pr-1`}>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="text-lg leading-7 font-medium">
              Esta ação moverá de forma definitiva o condomínio e todo o seu
              histórico de leituras (água, gás) e despesas para a nova
              administradora.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-medium text-slate-800">
              {condominios.length === 0
                ? "Não há condomínios órfãos ou da Administradora Master para vincular agora."
                : condominios.length === 1
                  ? "1 condomínio disponível para transferência."
                  : `${condominios.length} condomínios disponíveis para transferência.`}
            </p>
            <p className="mt-2 text-base leading-6 text-slate-600">
              Condomínios já ligados a outro cliente não aparecem nesta lista.
              Unidades, leituras e despesas acompanham o condomínio
              automaticamente.
            </p>
          </div>
        </div>
      </aside>

      <section className={`${CARTAO} lg:col-span-12`}>
        <h3 className="mb-2 shrink-0 text-2xl font-medium text-slate-900">
          Vínculos Atuais de Condomínios
        </h3>
        <p className="mb-5 shrink-0 text-lg text-slate-600">
          Visão geral de todos os condomínios e da administradora responsável
          por cada um.
        </p>
        {vinculos.length === 0 ? (
          <p className="text-lg text-slate-500">
            Nenhum condomínio cadastrado.
          </p>
        ) : (
          <div className={`${AREA_ROLAVEL} overflow-x-auto rounded-xl border border-slate-200`}>
            <table className="min-w-full border-collapse text-lg">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-medium text-slate-700">
                    Condomínio
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-medium text-slate-700">
                    Gestor / Administradora Responsável
                  </th>
                </tr>
              </thead>
              <tbody>
                {vinculos.map((item) => (
                  <tr
                    key={item.id}
                    className="bg-white transition hover:bg-slate-50/80"
                  >
                    <td className="border-t border-slate-200 px-4 py-3 font-medium text-slate-900">
                      {toTitleCase(item.nome)}
                    </td>
                    <td className="border-t border-slate-200 px-4 py-3">
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
