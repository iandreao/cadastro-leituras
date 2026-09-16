import { redirect } from "next/navigation";

export default function DespesasPage() {
  redirect("/despesas/gerenciar?aba=mes");
}
