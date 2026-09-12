"use server";

import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { ehCondominioVinculavel } from "@/lib/vincular-condominio";

export type CondominioVinculavel = {
  id: string;
  nome: string;
  gestorId: string | null;
  gestorNome: string | null;
};

export type VinculoCondominio = {
  id: string;
  nome: string;
  gestorId: string | null;
  gestorNome: string | null;
};

export type GestorDestino = {
  id: string;
  nome: string;
  ativo: boolean;
};

async function exigirSuperAdmin() {
  const session = await getSession();

  if (!session) {
    return { error: "Não autenticado." as const, session: null };
  }

  if (session.role !== "SUPER_ADMIN") {
    return {
      error: "Acesso restrito ao Super Admin." as const,
      session,
    };
  }

  return { error: null, session };
}

export async function carregarPainelVinculo() {
  const acesso = await exigirSuperAdmin();

  if (acesso.error || !acesso.session) {
    return {
      autorizado: false as const,
      role: acesso.session?.role ?? null,
      condominios: [] as CondominioVinculavel[],
      vinculos: [] as VinculoCondominio[],
      gestores: [] as GestorDestino[],
    };
  }

  const [todosCondominios, gestores] = await Promise.all([
    getPrisma().condominio.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        gestorId: true,
        gestor: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    }),
    getPrisma().gestor.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        ativo: true,
      },
    }),
  ]);

  const vinculos = todosCondominios.map((condominio) => ({
    id: condominio.id,
    nome: condominio.nome,
    gestorId: condominio.gestorId,
    gestorNome: ehCondominioVinculavel(condominio.gestorId)
      ? null
      : condominio.gestor?.nome ?? null,
  }));

  const condominios = vinculos;

  return {
    autorizado: true as const,
    role: Role.SUPER_ADMIN,
    condominios,
    vinculos,
    gestores,
  };
}
