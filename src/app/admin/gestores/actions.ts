"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { onlyDigits, toTitleCase } from "@/lib/masks";
import { getPrisma } from "@/lib/prisma";
import { garantirTenantPadrao } from "@/lib/multi-tenant";

export type GestorLista = {
  id: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  ativo: boolean;
  createdAt: Date;
};

export type ResultadoGestor =
  | { ok: true }
  | { error: string };

function textoCampo(formData: FormData, nome: string) {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

async function exigirSuperAdmin() {
  const session = await getSession();

  if (!session) {
    return { error: "Não autenticado." as const, session: null, usuario: null };
  }

  await garantirTenantPadrao();
  const usuario = await getPrisma().usuario.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true },
  });

  if (!usuario || usuario.role !== Role.SUPER_ADMIN) {
    return {
      error: "Acesso restrito ao Super Admin." as const,
      session,
      usuario,
    };
  }

  return { error: null, session, usuario };
}

export async function obterPerfilAdmin() {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return {
      autorizado: false as const,
      role: acesso.usuario?.role ?? null,
      error: acesso.error,
    };
  }

  return {
    autorizado: true as const,
    role: Role.SUPER_ADMIN,
    error: null,
  };
}

export async function listarGestores(): Promise<GestorLista[]> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return [];
  }

  return getPrisma().gestor.findMany({
    orderBy: { nomeFantasia: "asc" },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
      ativo: true,
      createdAt: true,
    },
  });
}

export async function criarGestor(formData: FormData): Promise<ResultadoGestor> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return { error: acesso.error };
  }

  const nomeFantasia = toTitleCase(textoCampo(formData, "nomeFantasia"));
  const razaoSocialBruto = textoCampo(formData, "razaoSocial");
  const razaoSocial = razaoSocialBruto ? toTitleCase(razaoSocialBruto) : null;
  const cnpjDigitos = onlyDigits(textoCampo(formData, "cnpj"));
  const cnpj = cnpjDigitos.length > 0 ? cnpjDigitos : null;

  if (!nomeFantasia) {
    return { error: "Informe o nome fantasia do gestor." };
  }

  if (cnpj && cnpj.length !== 14) {
    return { error: "Informe um CNPJ com 14 dígitos." };
  }

  try {
    await getPrisma().gestor.create({
      data: {
        nomeFantasia,
        razaoSocial,
        cnpj,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Já existe um gestor cadastrado com este CNPJ." };
    }

    return { error: "Não foi possível salvar o gestor. Tente novamente." };
  }

  revalidatePath("/admin/gestores");
  return { ok: true };
}
