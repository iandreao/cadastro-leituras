import { redirect } from "next/navigation";

export default function UnidadesPage() {
  redirect("/condominios/gerenciar?aba=unidades");
}
