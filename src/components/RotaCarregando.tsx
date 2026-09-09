export default function RotaCarregando() {
  return (
    <div
      className="w-full max-w-full space-y-3 overflow-x-hidden px-0 sm:px-2"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Carregando...</span>
      <section className="animate-pulse rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="h-11 rounded-lg bg-slate-100" />
          <div className="h-11 rounded-lg bg-slate-100" />
          <div className="h-11 rounded-lg bg-slate-100" />
        </div>
      </section>
      <section className="animate-pulse rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="mb-3 h-5 w-56 rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-8 rounded bg-slate-100" />
          <div className="h-8 rounded bg-slate-100" />
          <div className="h-8 rounded bg-slate-100" />
          <div className="h-8 rounded bg-slate-100" />
          <div className="h-8 rounded bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
