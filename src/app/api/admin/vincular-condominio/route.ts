import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  mensagemErroVinculo,
  transferirCondominioParaGestor,
} from "@/lib/vincular-condominio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function POST(request: Request) {
  const { session, error } = await requireApiSession(request);

  if (error || !session) {
    return error;
  }

  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito ao Super Admin." },
      { status: 403 },
    );
  }

  let corpo: unknown;

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    );
  }

  const dados = corpo && typeof corpo === "object" ? corpo : {};
  const condominioId = texto(
    "condominioId" in dados ? dados.condominioId : "",
  );
  const novoGestorId = texto(
    "novoGestorId" in dados ? dados.novoGestorId : "",
  );

  if (!condominioId || !novoGestorId) {
    return NextResponse.json(
      { error: "Selecione o condomínio e o gestor de destino." },
      { status: 400 },
    );
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      await transferirCondominioParaGestor(tx, condominioId, novoGestorId);
    });
  } catch (erro) {
    const mensagem = mensagemErroVinculo(erro);
    const status =
      erro instanceof Error &&
      (erro.message === "CONDOMINIO_INDISPONIVEL" ||
        erro.message === "GESTOR_NAO_ENCONTRADO" ||
        erro.message === "MESMO_GESTOR")
        ? 400
        : 500;

    return NextResponse.json({ error: mensagem }, { status });
  }

  revalidatePath("/admin/vincular-condominio");
  revalidatePath("/admin/gestores");
  revalidatePath("/condominios");
  revalidatePath("/admin/movimentos");

  return NextResponse.json({ ok: true });
}
