"use server";

import { Prisma, Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  isValidCnpj,
  isValidCpf,
  onlyDigits,
  toTitleCase,
} from "@/lib/masks";
import { getPrisma } from "@/lib/prisma";
import { GESTOR_PADRAO_ID } from "@/lib/multi-tenant";
import { hashSenha } from "@/lib/senha";

export type GestorLista = {
  id: string;
  nome: string;
  ativo: boolean;
};

export type GestorDetalhe = {
  id: string;
  nome: string;
  razaoSocial: string | null;
  email: string | null;
  celular: string | null;
  tipoPessoa: string;
  documento: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
};

export type ResultadoGestor = { ok: true } | { error: string };

function textoCampo(formData: FormData, nome: string) {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function textoOpcional(valor: string) {
  return valor ? valor : null;
}

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

function dadosDoFormulario(formData: FormData) {
  const tipoPessoaBruto = textoCampo(formData, "tipoPessoa").toUpperCase();
  const tipoPessoa =
    tipoPessoaBruto === "FISICA" ? "FISICA" : "JURIDICA";
  const nome = toTitleCase(textoCampo(formData, "nome"));
  const emailBruto = textoCampo(formData, "email").toLowerCase();
  const celular = onlyDigits(textoCampo(formData, "celular"));
  const documento = onlyDigits(textoCampo(formData, "documento"));
  const cep = onlyDigits(textoCampo(formData, "cep"));
  const estado = textoCampo(formData, "estado").toUpperCase();

  return {
    nome,
    razaoSocial: tipoPessoa === "JURIDICA" ? nome : textoOpcional(nome),
    email: textoOpcional(emailBruto),
    celular: textoOpcional(celular),
    tipoPessoa,
    documento: textoOpcional(documento),
    cep: textoOpcional(cep),
    logradouro: textoOpcional(toTitleCase(textoCampo(formData, "logradouro"))),
    numero: textoOpcional(textoCampo(formData, "numero")),
    complemento: textoOpcional(toTitleCase(textoCampo(formData, "complemento"))),
    bairro: textoOpcional(toTitleCase(textoCampo(formData, "bairro"))),
    cidade: textoOpcional(toTitleCase(textoCampo(formData, "cidade"))),
    estado: textoOpcional(estado),
  };
}

function validarGestor(dados: ReturnType<typeof dadosDoFormulario>) {
  if (!dados.nome) {
    return "Informe o nome ou razão social do gestor.";
  }

  if (!dados.email || !dados.email.includes("@")) {
    return "Informe um e-mail válido.";
  }

  if (dados.celular && dados.celular.length < 10) {
    return "Informe um celular com DDD.";
  }

  if (dados.tipoPessoa === "FISICA") {
    if (!dados.documento || !isValidCpf(dados.documento)) {
      return "Informe um CPF válido.";
    }
  } else if (!dados.documento || !isValidCnpj(dados.documento)) {
    return "Informe um CNPJ válido.";
  }

  if (dados.cep && dados.cep.length !== 8) {
    return "Informe um CEP com 8 dígitos.";
  }

  if (dados.estado && dados.estado.length !== 2) {
    return "Informe a UF com 2 letras.";
  }

  return null;
}

function mensagemUnica(error: Prisma.PrismaClientKnownRequestError) {
  const alvo = JSON.stringify(error.meta ?? {}).toLowerCase();

  if (alvo.includes("email")) {
    return "Já existe um gestor cadastrado com este e-mail.";
  }

  if (alvo.includes("documento")) {
    return "Já existe um gestor cadastrado com este CPF/CNPJ.";
  }

  return "Já existe um gestor com estes dados.";
}

async function senhaProvisoriaHash() {
  return hashSenha(randomBytes(32).toString("hex"));
}

async function garantirUsuarioGestorAdmin(
  tx: Prisma.TransactionClient,
  gestorId: string,
  nome: string,
  email: string,
) {
  const existente = await tx.usuario.findUnique({
    where: { email },
    select: { id: true, role: true, gestorId: true },
  });

  if (existente) {
    if (existente.role === Role.SUPER_ADMIN) {
      throw new Error("EMAIL_SUPER_ADMIN");
    }

    if (existente.gestorId && existente.gestorId !== gestorId) {
      throw new Error("EMAIL_EM_USO");
    }

    await tx.usuario.update({
      where: { id: existente.id },
      data: {
        nome,
        role: Role.GESTOR_ADMIN,
        gestorId,
      },
    });
    return;
  }

  const adminDoGestor = await tx.usuario.findFirst({
    where: { gestorId, role: Role.GESTOR_ADMIN },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (adminDoGestor) {
    await tx.usuario.update({
      where: { id: adminDoGestor.id },
      data: { nome, email },
    });
    return;
  }

  await tx.usuario.create({
    data: {
      nome,
      email,
      senha: await senhaProvisoriaHash(),
      role: Role.GESTOR_ADMIN,
      gestorId,
    },
  });
}

export async function obterPerfilAdmin() {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return {
      autorizado: false as const,
      role: acesso.session?.role ?? null,
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
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      ativo: true,
    },
  });
}

export async function obterGestor(id: string): Promise<GestorDetalhe | { error: string }> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return { error: acesso.error };
  }

  const gestorId = id.trim();

  if (!gestorId) {
    return { error: "Gestor não encontrado." };
  }

  const gestor = await getPrisma().gestor.findUnique({
    where: { id: gestorId },
    select: {
      id: true,
      nome: true,
      razaoSocial: true,
      email: true,
      celular: true,
      tipoPessoa: true,
      documento: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      estado: true,
      ativo: true,
    },
  });

  if (!gestor) {
    return { error: "Gestor não encontrado." };
  }

  return gestor;
}

export async function carregarPainelGestores() {
  const acesso = await exigirSuperAdmin();

  if (acesso.error || !acesso.session) {
    return {
      autorizado: false as const,
      role: acesso.session?.role ?? null,
      gestores: [] as GestorLista[],
    };
  }

  const gestores = await getPrisma().gestor.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      ativo: true,
    },
  });

  return {
    autorizado: true as const,
    role: Role.SUPER_ADMIN,
    gestores,
  };
}

export async function salvarGestor(formData: FormData): Promise<ResultadoGestor> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return { error: acesso.error };
  }

  const id = textoCampo(formData, "id");
  const dados = dadosDoFormulario(formData);
  const invalido = validarGestor(dados);

  if (invalido) {
    return { error: invalido };
  }

  const email = dados.email;

  if (!email) {
    return { error: "Informe um e-mail válido." };
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      if (id) {
        const existente = await tx.gestor.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!existente) {
          throw new Error("GESTOR_NAO_ENCONTRADO");
        }

        await tx.gestor.update({
          where: { id },
          data: dados,
        });
        await garantirUsuarioGestorAdmin(tx, id, dados.nome, email);
        return;
      }

      const criado = await tx.gestor.create({
        data: dados,
      });
      await garantirUsuarioGestorAdmin(tx, criado.id, dados.nome, email);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GESTOR_NAO_ENCONTRADO") {
      return { error: "Gestor não encontrado." };
    }

    if (error instanceof Error && error.message === "EMAIL_EM_USO") {
      return { error: "Já existe uma conta com este e-mail." };
    }

    if (error instanceof Error && error.message === "EMAIL_SUPER_ADMIN") {
      return {
        error:
          "Este e-mail já pertence ao Super Admin. Use o e-mail corporativo do cliente.",
      };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: mensagemUnica(error) };
    }

    return { error: "Não foi possível salvar o gestor. Tente novamente." };
  }

  revalidatePath("/admin/gestores");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/movimentos");
  revalidatePath("/admin/vincular-condominio");
  revalidatePath("/condominios");
  return { ok: true };
}

export async function alternarAtivoGestor(id: string): Promise<ResultadoGestor> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return { error: acesso.error };
  }

  const gestorId = id.trim();

  if (!gestorId) {
    return { error: "Gestor não encontrado." };
  }

  const gestor = await getPrisma().gestor.findUnique({
    where: { id: gestorId },
    select: { id: true, ativo: true },
  });

  if (!gestor) {
    return { error: "Gestor não encontrado." };
  }

  await getPrisma().gestor.update({
    where: { id: gestorId },
    data: { ativo: !gestor.ativo },
  });

  revalidatePath("/admin/gestores");
  return { ok: true };
}

export async function excluirGestor(id: string): Promise<ResultadoGestor> {
  const acesso = await exigirSuperAdmin();

  if (acesso.error) {
    return { error: acesso.error };
  }

  const gestorId = id.trim();

  if (!gestorId) {
    return { error: "Gestor não encontrado." };
  }

  if (gestorId === GESTOR_PADRAO_ID) {
    return { error: "A Administradora Master não pode ser excluída." };
  }

  const [condominios, movimentosFechados, movimentos, usuarios] =
    await Promise.all([
      getPrisma().condominio.count({ where: { gestorId } }),
      getPrisma().movimentoMensal.count({
        where: { gestorId, fechado: true },
      }),
      getPrisma().movimentoMensal.count({ where: { gestorId } }),
      getPrisma().usuario.count({ where: { gestorId } }),
    ]);

  if (condominios > 0) {
    return {
      error:
        "Não é possível excluir este gestor: existem condomínios vinculados a ele.",
    };
  }

  if (movimentosFechados > 0) {
    return {
      error:
        "Não é possível excluir este gestor: existem competências fechadas vinculadas a este tenant.",
    };
  }

  if (movimentos > 0) {
    return {
      error:
        "Não é possível excluir este gestor: existem movimentos mensais vinculados a este tenant.",
    };
  }

  if (usuarios > 0) {
    return {
      error:
        "Não é possível excluir este gestor: existem usuários vinculados a ele.",
    };
  }

  try {
    await getPrisma().gestor.delete({ where: { id: gestorId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error:
          "Não é possível excluir este gestor: há registros vinculados a ele.",
      };
    }

    return { error: "Não foi possível excluir o gestor. Tente novamente." };
  }

  revalidatePath("/admin/gestores");
  return { ok: true };
}
