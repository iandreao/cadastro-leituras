import { redirect } from "next/navigation";

export default function LeituraGasPage() {
  redirect("/leituras/gerenciar?aba=gas");
}
