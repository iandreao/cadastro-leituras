import { redirect } from "next/navigation";
import { ehPrimeiroAcesso } from "@/lib/primeiro-acesso";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (ehPrimeiroAcesso(session.primeiroAcesso)) {
    redirect("/nova-senha");
  }

  redirect("/condominios");
}
