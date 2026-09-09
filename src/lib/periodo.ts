export function periodoBrasil(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(agora);

  return {
    mes: Number(partes.find((parte) => parte.type === "month")?.value),
    ano: Number(partes.find((parte) => parte.type === "year")?.value),
  };
}

export function inteiroPeriodo(valor: unknown) {
  const numero = typeof valor === "number" ? valor : Number(String(valor ?? "").trim());
  return Number.isInteger(numero) ? numero : Number.NaN;
}

export function mesmoPeriodo(
  mesA: unknown,
  anoA: unknown,
  mesB: unknown,
  anoB: unknown,
) {
  return inteiroPeriodo(mesA) === inteiroPeriodo(mesB) &&
    inteiroPeriodo(anoA) === inteiroPeriodo(anoB);
}

export function marcarFechado(valor: unknown) {
  return valor === true || valor === 1 || valor === "1" || valor === "t" || valor === "true";
}

export function limitesCompetencia(mes: number, ano: number) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0, 0));
  const fim = new Date(Date.UTC(ano, mes, 1, 3, 0, 0, 0) - 1);
  return { inicio, fim };
}
