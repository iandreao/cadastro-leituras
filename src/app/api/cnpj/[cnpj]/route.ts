import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import {
  formatEnderecoReceita,
  isValidCnpj,
  onlyDigits,
  toTitleCase,
} from "@/lib/masks";

type EmpresaCnpj = {
  razao_social?: string;
  nome_fantasia?: string;
  nome?: string;
  fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  email?: string;
  telefone?: string;
  ddd_telefone_1?: string;
  status?: string;
  message?: string;
};

const headers = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CadastroLeituras/1.0",
};

function empresaFromJson(data: EmpresaCnpj) {
  const nome =
    data.razao_social?.trim() ||
    data.nome?.trim() ||
    data.nome_fantasia?.trim() ||
    data.fantasia?.trim() ||
    "";
  const endereco = formatEnderecoReceita(data);
  const telefone = data.telefone?.trim() || data.ddd_telefone_1?.trim() || "";

  return {
    nome: toTitleCase(nome),
    endereco: toTitleCase(endereco),
    email: data.email?.trim().toLowerCase() ?? "",
    celular: onlyDigits(telefone).slice(0, 11),
    cep: onlyDigits(data.cep ?? "").slice(0, 8),
    logradouro: toTitleCase(data.logradouro ?? ""),
    numero: data.numero?.trim() ?? "",
    complemento: toTitleCase(data.complemento ?? ""),
    bairro: toTitleCase(data.bairro ?? ""),
    cidade: toTitleCase(data.municipio ?? ""),
    estado: (data.uf ?? "").trim().toUpperCase().slice(0, 2),
  };
}

async function consultarUrl(url: string) {
  const response = await fetch(url, { cache: "no-store", headers });

  if (response.status === 404) {
    return { kind: "not-found" as const };
  }

  if (!response.ok) {
    return { kind: "upstream" as const };
  }

  const data = (await response.json()) as EmpresaCnpj;

  if (data.status === "ERROR") {
    return { kind: "not-found" as const };
  }

  const empresa = empresaFromJson(data);

  if (!empresa.nome) {
    return { kind: "not-found" as const };
  }

  return { kind: "ok" as const, empresa };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cnpj: string }> },
) {
  const { error } = await requireApiSession(request);

  if (error) {
    return error;
  }

  const { cnpj } = await context.params;
  const digits = decodeURIComponent(cnpj).replace(/\D/g, "");

  if (!isValidCnpj(digits)) {
    return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  }

  try {
    const receitaWs = await consultarUrl(
      `https://www.receitaws.com.br/v1/cnpj/${digits}`,
    );

    if (receitaWs.kind === "ok") {
      return NextResponse.json(receitaWs.empresa);
    }

    const brasilApi = await consultarUrl(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
    );

    if (brasilApi.kind === "ok") {
      return NextResponse.json(brasilApi.empresa);
    }

    if (receitaWs.kind === "not-found" || brasilApi.kind === "not-found") {
      return NextResponse.json(
        { error: "CNPJ não encontrado na Receita Federal." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível consultar a Receita Federal." },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar a Receita Federal." },
      { status: 502 },
    );
  }
}
