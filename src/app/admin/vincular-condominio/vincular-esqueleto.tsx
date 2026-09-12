const GRADE_VINCULO = "grid w-full grid-cols-1 gap-6 lg:grid-cols-12";

const CARTAO =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm lg:p-10";

export function VincularCondominioEsqueleto() {
  return (
    <div className={GRADE_VINCULO} aria-busy="true" aria-live="polite">
      <section className={`${CARTAO} lg:col-span-7`}>
        <div className="mb-6 h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="space-y-5">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </section>
      <aside className={`${CARTAO} lg:col-span-5`}>
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-36 animate-pulse rounded-2xl bg-amber-50" />
        <div className="mt-5 h-24 animate-pulse rounded-lg bg-slate-100" />
      </aside>
      <section className={`${CARTAO} lg:col-span-12`}>
        <div className="mb-5 h-8 w-80 animate-pulse rounded-lg bg-slate-200" />
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
