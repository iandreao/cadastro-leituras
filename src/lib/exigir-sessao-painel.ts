import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { ehPrimeiroAcesso } from "@/lib/primeiro-acesso";
import { getSession } from "@/lib/session";

const TTL_STATUS_MS = 45_000;

type StatusSessao = {
  ativo: boolean;
  primeiroAcesso: boolean;
  expira: number;
};

const memoriaSessao = globalThis as unknown as {
  statusSessao?: Map<string, StatusSessao>;
};

function mapaStatus() {
  if (!memoriaSessao.statusSessao) {
    memoriaSessao.statusSessao = new Map();
  }

  return memoriaSessao.statusSessao;
}

export function invalidarStatusSessao(usuarioId: string) {
  mapaStatus().delete(usuarioId);
}

export async function exigirSessaoLiberada() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (ehPrimeiroAcesso(session.primeiroAcesso)) {
    redirect("/nova-senha");
  }

  const mapa = mapaStatus();
  const emCache = mapa.get(session.sub);
  const cacheConfere =
    emCache != null &&
    emCache.expira > Date.now() &&
    emCache.ativo &&
    ehPrimeiroAcesso(emCache.primeiroAcesso) ===
      ehPrimeiroAcesso(session.primeiroAcesso);

  if (cacheConfere) {
    return session;
  }

  const usuario = await getPrisma().usuario.findUnique({
    where: { id: session.sub },
    select: { primeiroAcesso: true, ativo: true },
  });

  if (!usuario || usuario.ativo === false) {
    mapa.delete(session.sub);
    redirect("/login");
  }

  mapa.set(session.sub, {
    ativo: true,
    primeiroAcesso: ehPrimeiroAcesso(usuario.primeiroAcesso),
    expira: Date.now() + TTL_STATUS_MS,
  });

  if (ehPrimeiroAcesso(usuario.primeiroAcesso)) {
    redirect("/nova-senha");
  }

  return session;
}
