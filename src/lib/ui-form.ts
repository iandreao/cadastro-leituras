export const CAMPO =
  "h-9 w-full rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-800 placeholder:text-sm placeholder:text-slate-400 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const ROTULO_CAMPO =
  "mb-1 block text-sm font-medium text-slate-700";

export const ABA_LISTA =
  "flex shrink-0 flex-wrap gap-1 rounded-xl bg-slate-100 p-1";

export function classeAba(ativo: boolean) {
  return `rounded-lg px-4 py-2 text-base font-semibold transition ${
    ativo
      ? "bg-white text-teal-800 shadow-sm ring-1 ring-inset ring-teal-700/30"
      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
  }`;
}
