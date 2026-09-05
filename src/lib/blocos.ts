export const NOME_BLOCO_PADRAO = "Não se Aplica";

export function normalizarBloco(txt: string) {
  return txt.replace(/bloco/i, "").replace(/torre/i, "").trim().toUpperCase();
}

export function persistirBloco(txt: string | null | undefined) {
  return normalizarBloco(txt ?? "");
}

export function chaveNomeBloco(txt: string | null | undefined) {
  const bruto = (txt ?? "").trim();

  if (!bruto) {
    return persistirBloco(NOME_BLOCO_PADRAO);
  }

  return persistirBloco(bruto);
}

export function nomeBloco(
  bloco: string | { nome: string } | null | undefined,
) {
  if (!bloco) {
    return "";
  }

  return typeof bloco === "string" ? bloco : bloco.nome;
}

export function queryEscopoTipo(condominioId: string, blocoId: string) {
  const params = new URLSearchParams({ condominioId });
  params.set("blocoId", blocoId);
  return params.toString();
}

export const includeBloco = {
  bloco: {
    select: { id: true, nome: true },
  },
} as const;
