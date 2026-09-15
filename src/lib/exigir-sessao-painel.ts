import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { ehPrimeiroAcesso } from "@/lib/primeiro-acesso";
import { getSession } from "@/lib/session";

export async function exigirSessaoLiberada() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (ehPrimeiroAcesso(session.primeiroAcesso)) {
    redirect("/nova-senha");
  }

  const usuario = await getPrisma().usuario.findUnique({
    where: { id: session.sub },
    select: { primeiroAcesso: true, ativo: true },
  });

  if (!usuario || usuario.ativo === false) {
    redirect("/login");
  }

  if (ehPrimeiroAcesso(usuario.primeiroAcesso)) {
    redirect("/nova-senha");
  }

  return session;
}
