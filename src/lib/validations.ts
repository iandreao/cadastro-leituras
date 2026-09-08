import { z } from "zod";
import { isValidCnpj, onlyDigits } from "@/lib/masks";
import { TIPOS_CONSUMO } from "@/lib/unidades";

export const cadastroSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo."),
    email: z.email("Informe um e-mail válido."),
    senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmarSenha: z.string().min(6, "Confirme a senha."),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Informe um e-mail válido."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Link de redefinição inválido."),
    senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmarSenha: z.string().min(6, "Confirme a nova senha."),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const condominioSchema = z.object({
  cnpj: z
    .string()
    .refine((value) => onlyDigits(value).length === 14, "Informe o CNPJ completo.")
    .refine((value) => isValidCnpj(value), "CNPJ inválido."),
  nome: z.string().trim().min(2, "Informe o nome do condomínio."),
  endereco: z.string().trim().min(5, "Informe o endereço."),
  email: z.email("Informe um e-mail válido."),
  celular: z
    .string()
    .refine((value) => onlyDigits(value).length >= 10, "Informe um celular válido."),
});

export const unidadeSchema = z.object({
  numero: z.string().trim().min(1, "Informe o número da unidade."),
  nomeMorador: z.string().trim().default(""),
  celular: z
    .string()
    .default("")
    .refine(
      (value) => value === "" || onlyDigits(value).length >= 10,
      "Informe um celular válido.",
    ),
  tipoUnidadeId: z.string().min(1, "Selecione o tipo de unidade."),
  tipoConsumo: z.enum(TIPOS_CONSUMO),
  blocoId: z.string().min(1, "Selecione o bloco/torre."),
  condominioId: z.string().min(1, "Selecione o condomínio."),
});

export const unidadeLoteSchema = z.object({
  condominioId: z.string().min(1, "Selecione o condomínio."),
  tipoUnidadeId: z.string().min(1, "Selecione o tipo de unidade."),
  tipoConsumo: z.enum(TIPOS_CONSUMO),
  blocoId: z.string().min(1, "Selecione o bloco/torre."),
  numeros: z
    .array(z.string().trim().min(1))
    .min(1, "Informe as unidades do lote.")
    .max(400, "O lote não pode ter mais de 400 unidades."),
});

export const leituraSchema = z.object({
  unidadeId: z.string().min(1, "Selecione a unidade."),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(2100),
  valorAgua: z.union([z.coerce.number(), z.null()]).optional(),
  valorGas: z.union([z.coerce.number(), z.null()]).optional(),
});

export const leituraLoteSchema = z.object({
  condominioId: z.string().min(1, "Selecione o condomínio."),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(2100),
  tipo: z.enum(["agua", "gas"]),
  itens: z
    .array(
      z.object({
        unidadeId: z.string().min(1),
        valor: z.coerce.number(),
      }),
    )
    .min(1, "Informe ao menos uma leitura."),
});

export const FORMAS_COBRANCA = ["consumo", "divisao_igual"] as const;

const valorOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numero =
      typeof value === "number"
        ? value
        : Number(String(value).trim().replace(",", "."));

    return Number.isFinite(numero) ? numero : null;
  });

export const despesaMensalSchema = z.object({
  condominioId: z.string().min(1, "Selecione o condomínio."),
  blocoId: z.string().min(1, "Selecione o bloco/torre."),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(2100),
  tipoDespesaId: z.string().min(1, "Selecione o tipo de despesa."),
  valorTotal: valorOpcional,
  valorFixo: valorOpcional,
  valorVariavel: valorOpcional,
  formaCobranca: z.enum(FORMAS_COBRANCA),
});

export const idStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1, "Selecione o condomínio."));

export const blocoCadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do bloco/torre."),
  condominioId: idStringSchema,
});

export const tipoUnidadeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tipo de unidade."),
  condominioId: z.string().min(1, "Selecione o condomínio."),
  blocoId: z.string().min(1, "Selecione o bloco/torre."),
});

export const tipoDespesaConfigSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tipo de despesa."),
  condominioId: z.string().min(1, "Selecione o condomínio."),
  blocoId: z.string().min(1, "Selecione o bloco/torre."),
  tipoUnidadeIds: z.array(z.string().min(1)).default([]),
});

export const apuracaoSchema = z.object({
  condominioId: z.string().min(1, "Selecione o condomínio."),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(2100),
});

export const movimentoSchema = apuracaoSchema.extend({
  fechado: z.boolean(),
});
