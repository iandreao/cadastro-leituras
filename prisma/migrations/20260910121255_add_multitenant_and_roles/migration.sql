-- AlterTable
ALTER TABLE "Gestor" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeituraAgua" (
    "id" TEXT NOT NULL,
    "dataLeitura" TIMESTAMP(3) NOT NULL,
    "valorLeitura" DOUBLE PRECISION NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeituraAgua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeituraGas" (
    "id" TEXT NOT NULL,
    "dataLeitura" TIMESTAMP(3) NOT NULL,
    "valorLeitura" DOUBLE PRECISION NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeituraGas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoMensal" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimentoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_email_token_key" ON "password_reset_tokens"("email", "token");

-- CreateIndex
CREATE INDEX "LeituraAgua_unidadeId_idx" ON "LeituraAgua"("unidadeId");

-- CreateIndex
CREATE INDEX "LeituraAgua_unidadeId_dataLeitura_idx" ON "LeituraAgua"("unidadeId", "dataLeitura");

-- CreateIndex
CREATE INDEX "LeituraGas_unidadeId_idx" ON "LeituraGas"("unidadeId");

-- CreateIndex
CREATE INDEX "LeituraGas_unidadeId_dataLeitura_idx" ON "LeituraGas"("unidadeId", "dataLeitura");

-- CreateIndex
CREATE INDEX "MovimentoMensal_condominioId_idx" ON "MovimentoMensal"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoMensal_condominioId_mes_ano_key" ON "MovimentoMensal"("condominioId", "mes", "ano");

-- AddForeignKey
ALTER TABLE "LeituraAgua" ADD CONSTRAINT "LeituraAgua_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraGas" ADD CONSTRAINT "LeituraGas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoMensal" ADD CONSTRAINT "MovimentoMensal_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
