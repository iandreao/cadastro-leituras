-- Refatora Gestor: nome único, documento (CPF/CNPJ), e-mail e endereço.
-- Aditivo: cria colunas, faz backfill e só então remove os campos antigos.

ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "nome" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "celular" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "tipoPessoa" TEXT NOT NULL DEFAULT 'JURIDICA';
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "documento" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "cep" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "logradouro" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "numero" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "complemento" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "bairro" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "Gestor" ADD COLUMN IF NOT EXISTS "estado" TEXT;

UPDATE "Gestor"
SET "nome" = COALESCE(NULLIF(BTRIM("razaoSocial"), ''), NULLIF(BTRIM("nomeFantasia"), ''), 'Gestor')
WHERE "nome" IS NULL OR BTRIM("nome") = '';

UPDATE "Gestor"
SET "documento" = NULLIF(BTRIM("cnpj"), '')
WHERE "documento" IS NULL AND "cnpj" IS NOT NULL;

ALTER TABLE "Gestor" ALTER COLUMN "nome" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Gestor_email_key" ON "Gestor"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Gestor_documento_key" ON "Gestor"("documento");

DROP INDEX IF EXISTS "Gestor_cnpj_key";
ALTER TABLE "Gestor" DROP COLUMN IF EXISTS "cnpj";
ALTER TABLE "Gestor" DROP COLUMN IF EXISTS "nomeFantasia";
