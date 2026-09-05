import { nomeMes } from "@/lib/leituras";
import { onlyDigits, toTitleCase } from "@/lib/masks";

const LARGURA_ROTULO_COBRANCA = 11;
const LARGURA_VALOR_COBRANCA = 6;

function formatarValorCobranca(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function telefoneWhatsApp(celular: string | null | undefined) {
  const digits = onlyDigits(celular ?? "");

  if (digits.length < 10) {
    return "";
  }

  return digits.startsWith("55") ? digits : `55${digits}`;
}

function linhaValorMonoespace(rotulo: string, valorFormatado: string) {
  const etiqueta = `${rotulo.padEnd(LARGURA_ROTULO_COBRANCA - 1, ".")}:`;
  const blocoValor = `R$ ${valorFormatado.padStart(LARGURA_VALOR_COBRANCA, " ")}`;
  return `${etiqueta} ${blocoValor}`;
}

export function montarMensagemCobranca(dados: {
  nomeMorador: string;
  mes: number;
  ano: number;
  taxaMensal: number;
  valorAgua: number;
  valorGas: number;
  valorOutras: number;
  valorTotal: number;
}) {
  const morador = dados.nomeMorador.trim()
    ? toTitleCase(dados.nomeMorador)
    : "Morador";
  const periodo = `${nomeMes(dados.mes)}/${dados.ano}`;
  const itens: Array<[string, string]> = [
    ["Txa Mensal", formatarValorCobranca(dados.taxaMensal)],
    ["Água", formatarValorCobranca(dados.valorAgua)],
    ["Gás", formatarValorCobranca(dados.valorGas)],
    ["Outros", formatarValorCobranca(dados.valorOutras)],
    ["Total", formatarValorCobranca(dados.valorTotal)],
  ];
  const tabela = itens
    .map(([rotulo, valor]) => linhaValorMonoespace(rotulo, valor))
    .join("\n");

  return [
    `Olá, ${morador}`,
    `Segue sua conta do condomínio do mês ${periodo}:`,
    "",
    `\`\`\`\n${tabela}\n\`\`\``,
    "",
    "O valor Total deve ser pago até o quinto dia, a contar do recebimento desta mensagem, via chave Pix 68647341000197 (Condominio Edifício Venetto).",
  ].join("\n");
}

export function linkWhatsAppCobranca(
  celular: string | null | undefined,
  mensagem: string,
) {
  const telefone = telefoneWhatsApp(celular);

  if (!telefone) {
    return "";
  }

  const texto = encodeURIComponent(mensagem);
  return `whatsapp://send?phone=${telefone}&text=${texto}`;
}

export function dispararWhatsApp(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
