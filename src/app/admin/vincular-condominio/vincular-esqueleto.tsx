const CARTAO =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pb-8 shadow-sm lg:p-8";

export function VincularCondominioEsqueleto() {
  return (
    <div
      className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      aria-busy="true"
      aria-live="polite"
    >
      <section className={CARTAO}>
        <div className="mb-6 h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="mb-6 h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="space-y-5">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </section>
      <section className={CARTAO}>
        <div className="mb-5 flex items-center justify-between">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-5 w-8 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="max-h-[480px] space-y-2 overflow-hidden pr-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
