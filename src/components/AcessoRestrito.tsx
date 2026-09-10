import Link from "next/link";

export default function AcessoRestrito({
  mensagem = "Seu perfil não tem permissão para acessar esta área.",
}: {
  mensagem?: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl" aria-hidden="true">
          🚫
        </p>
        <h1 className="mt-4 text-2xl font-medium text-slate-900">
          Acesso Restrito
        </h1>
        <p className="mt-2 text-lg text-slate-600">{mensagem}</p>
        <Link
          href="/condominios"
          className="mt-6 inline-block rounded-lg bg-teal-700 px-4 py-2.5 text-lg font-medium text-white hover:bg-teal-800"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
