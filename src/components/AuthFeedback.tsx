export function AuthFeedback({
  tipo,
  titulo,
  mensagem,
}: {
  tipo: "erro" | "sucesso";
  titulo: string;
  mensagem: string;
}) {
  const estilo =
    tipo === "sucesso"
      ? "border-teal-200 bg-teal-50 text-teal-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`rounded-lg border p-4 text-base font-medium shadow-sm ${estilo}`} role="status">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-0.5 leading-6 opacity-90">{mensagem}</p>
    </div>
  );
}

export default AuthFeedback;
