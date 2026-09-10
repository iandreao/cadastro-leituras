"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  isValidCnpj,
  isValidCpf,
  onlyDigits,
  toTitleCase,
} from "@/lib/masks";
import { getPrisma } from "@/lib/prisma";
import { GESTOR_PADRAO_ID, garantirTenantPadrao } from "@/lib/multi-tenant";

export type GestorLista = {
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
  createdAt: Date;
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
    orderBy: { nome: "asc" },
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
      createdAt: true,
    },
  });
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

  try {
    if (id) {
      const existente = await getPrisma().gestor.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existente) {
        return { error: "Gestor não encontrado." };
      }

      await getPrisma().gestor.update({
        where: { id },
        data: dados,
      });
    } else {
      await getPrisma().gestor.create({
        data: dados,
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: mensagemUnica(error) };
    }

    return { error: "Não foi possível salvar o gestor. Tente novamente." };
  }

  revalidatePath("/admin/gestores");
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
