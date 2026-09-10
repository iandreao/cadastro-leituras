"use client";

import { useEffect, useState, useTransition } from "react";
import { AREA_ROLAVEL, CARTAO_LISTA } from "@/lib/layout-cadastro";
import AcessoRestrito from "@/components/AcessoRestrito";
import {
  listarGestoresOpcoes,
  type GestorOpcao,
} from "../usuarios/actions";
import {
  alterarCompetencia,
  listarCompetencias,
  obterPerfilMovimentos,
  type CompetenciaLista,
} from "./actions";

function mesDoisDigitos(mes: number) {
  return String(mes).padStart(2, "0");
}

export default function MovimentosPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [ehSuperAdmin, setEhSuperAdmin] = useState(false);
  const [podeReabrir, setPodeReabrir] = useState(false);
  const [gestorId, setGestorId] = useState("");
  const [gestores, setGestores] = useState<GestorOpcao[]>([]);
  const [lista, setLista] = useState<CompetenciaLista[]>([]);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar(gestorSelecionado?: string) {
    const perfil = await obterPerfilMovimentos();

    if (!perfil.autorizado) {
      setAutorizado(false);
      return;
    }

    const superAdmin = perfil.role === "SUPER_ADMIN";
    setEhSuperAdmin(superAdmin);
    setPodeReabrir(
      perfil.role === "GESTOR_ADMIN" || perfil.role === "SUPER_ADMIN",
    );

    const gestoresLista = superAdmin
      ? await listarGestoresOpcoes()
      : [];
    setGestores(gestoresLista);

    const escolhido =
      gestorSelecionado ??
      gestorId ??
      (superAdmin ? gestoresLista[0]?.id ?? "" : "");

    if (superAdmin && escolhido && escolhido !== gestorId) {
      setGestorId(escolhido);
    }

    const competencias = await listarCompetencias(
      superAdmin ? escolhido : undefined,
    );
    setLista(competencias);
    setAutorizado(true);
  }

  function onAlterar(item: CompetenciaLista, fechado: boolean) {
    setErro("");
    setInfo("");
    startTransition(async () => {
      const resultado = await alterarCompetencia(
        item.mes,
        item.ano,
        fechado,
        ehSuperAdmin ? gestorId : undefined,
      );

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      setInfo(
        fechado
          ? `Competência ${mesDoisDigitos(item.mes)}/${item.ano} fechada.`
          : `Competência ${mesDoisDigitos(item.mes)}/${item.ano} reaberta.`,
      );
      const competencias = await listarCompetencias(
        ehSuperAdmin ? gestorId : undefined,
      );
      setLista(competencias);
    });
  }

  if (autorizado === false) {
    return <AcessoRestrito />;
  }

  return (
    <section className={CARTAO_LISTA}>
      <h2 className="mb-1 shrink-0 text-2xl font-medium text-slate-900">
        Fechamento de mês
      </h2>
      <p className="mb-4 text-lg text-slate-600">
        Trava de competência por tenant: com o mês fechado, leituras e despesas
        não podem ser lançadas.
      </p>

      {ehSuperAdmin ? (
        <label className="mb-4 block max-w-md">
          <span className="mb-1 block text-lg font-medium text-slate-700">
            Gestor / Cliente
          </span>
          <select
            value={gestorId}
            onChange={(event) => {
              const valor = event.target.value;
              setGestorId(valor);
              void carregar(valor);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
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
        <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-lg text-teal-800">
          {info}
        </p>
      ) : null}
      {erro ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
          {erro}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <p className="text-lg text-slate-500">Nenhuma competência para exibir.</p>
      ) : (
        <div className={`${AREA_ROLAVEL} rounded-md border border-gray-300`}>
          <table className="w-full border-collapse text-base">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                  Mês
                </th>
                <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                  Ano
                </th>
                <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                  Situação
                </th>
                <th className="border border-gray-300 px-3 py-1 text-left font-medium text-slate-700">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((item) => (
                <tr
                  key={`${item.ano}-${item.mes}`}
                  className={item.atual ? "bg-teal-50/60" : undefined}
                >
                  <td className="border border-gray-300 px-3 py-1 font-mono tabular-nums text-slate-800">
                    {mesDoisDigitos(item.mes)} · {item.rotuloMes}
                  </td>
                  <td className="border border-gray-300 px-3 py-1 font-mono tabular-nums text-slate-800">
                    {item.ano}
                  </td>
                  <td className="border border-gray-300 px-3 py-1 text-slate-700">
                    {item.fechado ? "Fechado" : "Aberto"}
                  </td>
                  <td className="border border-gray-300 px-3 py-1">
                    {item.fechado ? (
                      <button
                        type="button"
                        disabled={pending || !podeReabrir}
                        onClick={() => onAlterar(item, false)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reabrir mês
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onAlterar(item, true)}
                        className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-70"
                      >
                        Fechar mês
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
