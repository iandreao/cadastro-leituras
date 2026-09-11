"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { toTitleCase } from "@/lib/masks";
import { getPrisma } from "@/lib/prisma";
import {
  ehSuperAdmin,
  escopoTenant,
  resolverGestorIdDeCadastro,
} from "@/lib/multi-tenant";
import { apagarTokensPorEmail } from "@/lib/password-reset-token";
import { hashSenha } from "@/lib/senha";

export type UsuarioLista = {
  id: string;
  nome: string;
  email: string;
  role: "GESTOR_ADMIN" | "OPERADOR";
  ativo: boolean;
  gestorId: string | null;
  gestorNome: string | null;
  createdAt: Date;
};

export type GestorOpcao = {
  id: string;
  nome: string;
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

function ativoDoFormulario(valor: string, padrao: boolean) {
  if (valor === "true") {
    return true;
  }

  if (valor === "false") {
    return false;
  }

  return padrao;
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
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
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
      ativo: true,
      gestorId: true,
      createdAt: true,
      gestor: {
        select: { nome: true },
      },
    },
  });

  return usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role === Role.GESTOR_ADMIN ? "GESTOR_ADMIN" : "OPERADOR",
    ativo: usuario.ativo,
    gestorId: usuario.gestorId,
    gestorNome: usuario.gestor?.nome ?? null,
    createdAt: usuario.createdAt,
  }));
}

async function localizarUsuarioDoTenant(id: string, session: NonNullable<
  Awaited<ReturnType<typeof exigirGestorOuSuperAdmin>>["session"]
>) {
  return getPrisma().usuario.findFirst({
    where: {
      id,
      ...escopoTenant(session),
      role: { not: Role.SUPER_ADMIN },
    },
    select: {
      id: true,
      email: true,
      gestorId: true,
    },
  });
}

export async function salvarUsuario(
  formData: FormData,
): Promise<ResultadoUsuario> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return { error: acesso.error ?? "Não autenticado." };
  }

  const id = textoCampo(formData, "id");
  const nome = toTitleCase(textoCampo(formData, "nome"));
  const email = textoCampo(formData, "email").toLowerCase();
  const senha = textoCampo(formData, "senha");
  const roleInformada = textoCampo(formData, "role") || Role.OPERADOR;
  const role = roleDoCadastro(roleInformada);
  const ativo = ativoDoFormulario(textoCampo(formData, "ativo"), true);
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

  if (!id && senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (id && senha && senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (!role) {
    return { error: "Selecione o perfil do usuário." };
  }

  if (!gestorId) {
    return { error: "Usuário sem gestor associado." };
  }

  if (id && id === acesso.session.sub && ativo === false) {
    return { error: "Você não pode desativar a própria conta." };
  }

  try {
    if (id) {
      const existente = await localizarUsuarioDoTenant(id, acesso.session);

      if (!existente) {
        return { error: "Usuário não encontrado." };
      }

      await getPrisma().usuario.update({
        where: { id: existente.id },
        data: {
          nome,
          email,
          role,
          ativo,
          gestorId,
          ...(senha ? { senha: await hashSenha(senha) } : {}),
        },
      });
    } else {
      await getPrisma().usuario.create({
        data: {
          nome,
          email,
          senha: await hashSenha(senha),
          role,
          ativo,
          gestorId,
        },
      });
    }
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

export async function excluirUsuario(id: string): Promise<ResultadoUsuario> {
  const acesso = await exigirGestorOuSuperAdmin();

  if (acesso.error || !acesso.session) {
    return { error: acesso.error ?? "Não autenticado." };
  }

  const usuarioId = id.trim();

  if (!usuarioId) {
    return { error: "Usuário não encontrado." };
  }

  if (usuarioId === acesso.session.sub) {
    return { error: "Você não pode excluir a própria conta." };
  }

  const usuario = await localizarUsuarioDoTenant(usuarioId, acesso.session);

  if (!usuario) {
    return { error: "Usuário não encontrado." };
  }

  try {
    await apagarTokensPorEmail(usuario.email);
    await getPrisma().usuario.delete({ where: { id: usuario.id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error:
          "Não é possível excluir este usuário: ele possui vínculos históricos.",
      };
    }

    return { error: "Não foi possível excluir o usuário. Tente novamente." };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
