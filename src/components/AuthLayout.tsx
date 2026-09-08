export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b3b4a] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/20" />
        <div className="absolute -bottom-16 left-10 h-64 w-64 rounded-full bg-amber-400/15" />

        <div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight">
            Gestão de Condomínio
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-teal-50/80">
            Controle condomínios, unidades e medições em um único fluxo.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f4f7f8] px-4 py-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
