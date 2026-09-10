-- AlterTable: trava de competência por tenant (aditivo, sem drop/reset)
ALTER TABLE "MovimentoMensal" ADD COLUMN IF NOT EXISTS "gestorId" TEXT;

UPDATE "MovimentoMensal" AS m
SET "gestorId" = c."gestorId"
FROM "Condominio" AS c
WHERE c."id" = m."condominioId"
  AND (m."gestorId" IS NULL OR m."gestorId" = '');

UPDATE "MovimentoMensal"
SET "gestorId" = 'default-master-gestor-id'
WHERE "gestorId" IS NULL OR "gestorId" = '';

ALTER TABLE "MovimentoMensal" ALTER COLUMN "gestorId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "MovimentoMensal_gestorId_idx" ON "MovimentoMensal"("gestorId");

DO $$ BEGIN
  ALTER TABLE "MovimentoMensal"
    ADD CONSTRAINT "MovimentoMensal_gestorId_fkey"
    FOREIGN KEY ("gestorId") REFERENCES "Gestor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MovimentoMensal_mes_ano_gestorId_key"
  ON "MovimentoMensal"("mes", "ano", "gestorId");
