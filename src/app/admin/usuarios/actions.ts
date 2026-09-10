"use server";

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { toTitleCase } from "@/lib/masks";
import { getPrisma } from "@/lib/prisma";
import {
  ehSuperAdmin,
  escopoTenant,
  resolverGestorIdDeCadastro,
} from "@/lib/multi-tenant";

export type UsuarioLista = {
  id: string;
  nome: string;
  email: string;
  role: "GESTOR_ADMIN" | "OPERADOR";
  gestorId: string | null;
  gestorNome: string | null;
  createdAt: Date;
};

export type GestorOpcao = {
  id: string;
  nomeFantasia: string;
};

export type ResultadoUsuario = { ok: true } | { error: string };

function textoCampo(formData: FormData, nome: string) {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function roleDoCadastro(valor: string): "GESTOR_ADMIN" | "OPERADOR" | null {
  if (valor === Role.GESTOR_ADMIN || valor === Role.OPERADOR) {
    return valor;
  }

  return null;
}

async function exigirGestorOuSuperAdmin() {
  const session = await getSession();

  if (!session) {
    return { error: "Não autenticado." as const, session: null };
  }

  if (session.role !== "SUPER_ADMIN" && session.role !== "GESTOR_ADMIN") {
    return {
      error: "Acesso restrito ao gestor da administradora." as const,
      session: null,
    };
  }

  return { error: null, session };
}

export async function obterPerfilUsuarios() {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return {
      autorizado: false as const,
      role: null as "SUPER_ADMIN" | "GESTOR_ADMIN" | null,
      error: acesso.error,
    };
  }

  return {
    autorizado: true as const,
    role: acesso.session.role as "SUPER_ADMIN" | "GESTOR_ADMIN",
    error: null,
  };
}

export async function listarGestoresOpcoes(): Promise<GestorOpcao[]> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session || !ehSuperAdmin(acesso.session)) {
    return [];
  }

  return getPrisma().gestor.findMany({
    where: { ativo: true },
    orderBy: { nomeFantasia: "asc" },
    select: { id: true, nomeFantasia: true },
  });
}

export async function listarUsuarios(): Promise<UsuarioLista[]> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return [];
  }

  const usuarios = await getPrisma().usuario.findMany({
    where: {
      ...escopoTenant(acesso.session),
      role: { not: Role.SUPER_ADMIN },
    },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      gestorId: true,
      createdAt: true,
      gestor: {
        select: { nomeFantasia: true },
      },
    },
  });

  return usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role === Role.GESTOR_ADMIN ? "GESTOR_ADMIN" : "OPERADOR",
    gestorId: usuario.gestorId,
    gestorNome: usuario.gestor?.nomeFantasia ?? null,
    createdAt: usuario.createdAt,
  }));
}

export async function salvarUsuario(
  formData: FormData,
): Promise<ResultadoUsuario> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return { error: acesso.error ?? "Não autenticado." };
  }

  const nome = toTitleCase(textoCampo(formData, "nome"));
  const email = textoCampo(formData, "email").toLowerCase();
  const senha = textoCampo(formData, "senha");
  const roleInformada = textoCampo(formData, "role") || Role.OPERADOR;
  const role = roleDoCadastro(roleInformada);
  const gestorId = await resolverGestorIdDeCadastro(
    acesso.session,
    ehSuperAdmin(acesso.session) ? textoCampo(formData, "gestorId") : undefined,
  );

  if (!nome || nome.length < 3) {
    return { error: "Informe o nome completo." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  if (senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (!role) {
    return { error: "Selecione o perfil do usuário." };
  }

  if (!gestorId) {
    return { error: "Usuário sem gestor associado." };
  }

  try {
    await getPrisma().usuario.create({
      data: {
        nome,
        email,
        senha: await bcrypt.hash(senha, 10),
        role,
        gestorId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Já existe uma conta com este e-mail." };
    }

    return { error: "Não foi possível salvar o usuário. Tente novamente." };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
