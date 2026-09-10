-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'GESTOR_ADMIN', 'OPERADOR');

-- CreateTable
CREATE TABLE "public"."Bloco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,

    CONSTRAINT "Bloco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Condominio" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gestorId" TEXT,

    CONSTRAINT "Condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DespesaMensal" (
    "id" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "valorFixo" DOUBLE PRECISION,
    "valorVariavel" DOUBLE PRECISION,
    "formaCobranca" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "tipoDespesaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FaturaUnidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valorAgua" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorEnergia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorGas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorOutras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaturaUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gestor" (
    "id" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "cnpj" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gestor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HistoricoMorador" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nomeMorador" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "celular" TEXT NOT NULL DEFAULT '',
    "dataEntrada" TIMESTAMP(3) NOT NULL,
    "dataSaida" TIMESTAMP(3),

    CONSTRAINT "HistoricoMorador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Leitura" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valorAgua" DOUBLE PRECISION,
    "valorGas" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegraParticipacao" (
    "id" TEXT NOT NULL,
    "tipoUnidadeId" TEXT NOT NULL,
    "tipoDespesaId" TEXT NOT NULL,

    CONSTRAINT "RegraParticipacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TipoDespesa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,

    CONSTRAINT "TipoDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TipoUnidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,

    CONSTRAINT "TipoUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Unidade" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nomeMorador" TEXT NOT NULL DEFAULT '',
    "celular" TEXT NOT NULL DEFAULT '',
    "tipoUnidadeId" TEXT NOT NULL,
    "tipoConsumo" TEXT NOT NULL DEFAULT 'Água/Gás',
    "blocoId" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'OPERADOR',
    "gestorId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bloco_condominioId_idx" ON "public"."Bloco"("condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Bloco_nome_condominioId_key" ON "public"."Bloco"("nome" ASC, "condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_cnpj_key" ON "public"."Condominio"("cnpj" ASC);

-- CreateIndex
CREATE INDEX "Condominio_gestorId_idx" ON "public"."Condominio"("gestorId" ASC);

-- CreateIndex
CREATE INDEX "DespesaMensal_blocoId_idx" ON "public"."DespesaMensal"("blocoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DespesaMensal_condominioId_blocoId_mes_ano_tipoDespesaId_key" ON "public"."DespesaMensal"("condominioId" ASC, "blocoId" ASC, "mes" ASC, "ano" ASC, "tipoDespesaId" ASC);

-- CreateIndex
CREATE INDEX "DespesaMensal_condominioId_idx" ON "public"."DespesaMensal"("condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FaturaUnidade_unidadeId_mes_ano_key" ON "public"."FaturaUnidade"("unidadeId" ASC, "mes" ASC, "ano" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Gestor_cnpj_key" ON "public"."Gestor"("cnpj" ASC);

-- CreateIndex
CREATE INDEX "HistoricoMorador_unidadeId_dataEntrada_idx" ON "public"."HistoricoMorador"("unidadeId" ASC, "dataEntrada" ASC);

-- CreateIndex
CREATE INDEX "HistoricoMorador_unidadeId_idx" ON "public"."HistoricoMorador"("unidadeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Leitura_unidadeId_mes_ano_key" ON "public"."Leitura"("unidadeId" ASC, "mes" ASC, "ano" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RegraParticipacao_tipoUnidadeId_tipoDespesaId_key" ON "public"."RegraParticipacao"("tipoUnidadeId" ASC, "tipoDespesaId" ASC);

-- CreateIndex
CREATE INDEX "TipoDespesa_blocoId_idx" ON "public"."TipoDespesa"("blocoId" ASC);

-- CreateIndex
CREATE INDEX "TipoDespesa_condominioId_idx" ON "public"."TipoDespesa"("condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TipoDespesa_nome_condominioId_blocoId_key" ON "public"."TipoDespesa"("nome" ASC, "condominioId" ASC, "blocoId" ASC);

-- CreateIndex
CREATE INDEX "TipoUnidade_blocoId_idx" ON "public"."TipoUnidade"("blocoId" ASC);

-- CreateIndex
CREATE INDEX "TipoUnidade_condominioId_idx" ON "public"."TipoUnidade"("condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TipoUnidade_nome_condominioId_blocoId_key" ON "public"."TipoUnidade"("nome" ASC, "condominioId" ASC, "blocoId" ASC);

-- CreateIndex
CREATE INDEX "Unidade_blocoId_idx" ON "public"."Unidade"("blocoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_condominioId_blocoId_numero_key" ON "public"."Unidade"("condominioId" ASC, "blocoId" ASC, "numero" ASC);

-- CreateIndex
CREATE INDEX "Unidade_condominioId_idx" ON "public"."Unidade"("condominioId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_gestorId_idx" ON "public"."users"("gestorId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Bloco" ADD CONSTRAINT "Bloco_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "public"."Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Condominio" ADD CONSTRAINT "Condominio_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "public"."Gestor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DespesaMensal" ADD CONSTRAINT "DespesaMensal_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "public"."Bloco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DespesaMensal" ADD CONSTRAINT "DespesaMensal_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "public"."Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DespesaMensal" ADD CONSTRAINT "DespesaMensal_tipoDespesaId_fkey" FOREIGN KEY ("tipoDespesaId") REFERENCES "public"."TipoDespesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FaturaUnidade" ADD CONSTRAINT "FaturaUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "public"."Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HistoricoMorador" ADD CONSTRAINT "HistoricoMorador_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "public"."Unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Leitura" ADD CONSTRAINT "Leitura_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "public"."Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegraParticipacao" ADD CONSTRAINT "RegraParticipacao_tipoDespesaId_fkey" FOREIGN KEY ("tipoDespesaId") REFERENCES "public"."TipoDespesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegraParticipacao" ADD CONSTRAINT "RegraParticipacao_tipoUnidadeId_fkey" FOREIGN KEY ("tipoUnidadeId") REFERENCES "public"."TipoUnidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TipoDespesa" ADD CONSTRAINT "TipoDespesa_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "public"."Bloco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TipoDespesa" ADD CONSTRAINT "TipoDespesa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "public"."Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TipoUnidade" ADD CONSTRAINT "TipoUnidade_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "public"."Bloco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TipoUnidade" ADD CONSTRAINT "TipoUnidade_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "public"."Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Unidade" ADD CONSTRAINT "Unidade_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "public"."Bloco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Unidade" ADD CONSTRAINT "Unidade_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "public"."Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Unidade" ADD CONSTRAINT "Unidade_tipoUnidadeId_fkey" FOREIGN KEY ("tipoUnidadeId") REFERENCES "public"."TipoUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "public"."Gestor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

