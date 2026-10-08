import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ehSuperAdmin, escopoTenant, viaCondominio } from "@/lib/multi-tenant";

const TTL_CADASTRO_MS = 20_000;

type Entrada<T> = {
  expira: number;
  dados: T;
};

type CondominioResumoCache = {
  id: string;
  nome: string;
  chavePix: string | null;
};

type UnidadeLeituraCache = {
  id: string;
  numero: string;
  tipoConsumo: string;
  condominioId: string;
  tipoUnidade: { id: string; nome: string };
  bloco: { id: string; nome: string };
};

const memoria = globalThis as unknown as {
  cacheCondominiosResumo?: Map<string, Entrada<CondominioResumoCache[]>>;
  cacheUnidadesLeitura?: Map<string, Entrada<UnidadeLeituraCache[]>>;
  geracaoCacheCadastro?: number;
};

function mapaCondominios() {
  if (!memoria.cacheCondominiosResumo) {
    memoria.cacheCondominiosResumo = new Map();
  }

  return memoria.cacheCondominiosResumo;
}

function mapaUnidades() {
  if (!memoria.cacheUnidadesLeitura) {
    memoria.cacheUnidadesLeitura = new Map();
  }

  return memoria.cacheUnidadesLeitura;
}

function chaveTenant(session: SessionUser) {
  if (ehSuperAdmin(session)) {
    return "super";
  }

  return session.gestorId?.trim() || "sem-gestor";
}

function lerCache<T>(mapa: Map<string, Entrada<T>>, chave: string) {
  const entrada = mapa.get(chave);

  if (!entrada || entrada.expira <= Date.now()) {
    mapa.delete(chave);
    return null;
  }

  return entrada.dados;
}

function gravarCache<T>(
  mapa: Map<string, Entrada<T>>,
  chave: string,
  dados: T,
  geracao: number,
) {
  if (geracao !== (memoria.geracaoCacheCadastro ?? 0)) {
    return dados;
  }

  mapa.set(chave, { dados, expira: Date.now() + TTL_CADASTRO_MS });
  return dados;
}

export function invalidarCacheCadastro() {
  memoria.geracaoCacheCadastro = (memoria.geracaoCacheCadastro ?? 0) + 1;
  mapaCondominios().clear();
  mapaUnidades().clear();
}

export async function listarCondominiosResumo(session: SessionUser) {
  const mapa = mapaCondominios();
  const chave = chaveTenant(session);
  const emCache = lerCache(mapa, chave);

  if (emCache) {
    return emCache;
  }

  const geracao = memoria.geracaoCacheCadastro ?? 0;
  const dados = await prisma.condominio.findMany({
    where: escopoTenant(session),
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, chavePix: true },
  });

  return gravarCache(mapa, chave, dados, geracao);
}

export async function listarBlocosResumo(session: SessionUser) {
  return prisma.bloco.findMany({
    where: viaCondominio(session),
    select: { id: true, nome: true, condominioId: true },
    orderBy: { nome: "asc" },
  });
}

export async function listarUnidadesLeitura(
  condominioId: string,
  session: SessionUser,
) {
  const mapa = mapaUnidades();
  const chave = `${chaveTenant(session)}:${condominioId}`;
  const emCache = lerCache(mapa, chave);

  if (emCache) {
    return emCache;
  }

  const geracao = memoria.geracaoCacheCadastro ?? 0;
  const dados = await prisma.unidade.findMany({
    where: { condominioId, ...viaCondominio(session) },
    orderBy: [{ bloco: { nome: "asc" } }, { numero: "asc" }],
    select: {
      id: true,
      numero: true,
      tipoConsumo: true,
      condominioId: true,
      tipoUnidade: { select: { id: true, nome: true } },
      bloco: { select: { id: true, nome: true } },
    },
  });

  return gravarCache(mapa, chave, dados, geracao);
}
