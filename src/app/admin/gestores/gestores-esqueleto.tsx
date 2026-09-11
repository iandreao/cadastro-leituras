import {
  AREA_ROLAVEL,
  CARTAO_FORMULARIO,
  CARTAO_LISTA,
  GRADE_CADASTRO,
} from "@/lib/layout-cadastro";

export function GestoresEsqueleto() {
  return (
    <div className={GRADE_CADASTRO} aria-busy="true" aria-live="polite">
      <section className={CARTAO_FORMULARIO}>
        <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className={`${AREA_ROLAVEL} space-y-4 pr-1`}>
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-11 w-40 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </section>
      <aside className={CARTAO_LISTA}>
        <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className={`${AREA_ROLAVEL} space-y-2 rounded-md border border-slate-200 p-3`}>
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
        </div>
      </aside>
    </div>
  );
}
