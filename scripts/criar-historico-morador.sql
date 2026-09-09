CREATE TABLE IF NOT EXISTS "HistoricoMorador" (
  "id" TEXT NOT NULL,
  "unidadeId" TEXT NOT NULL,
  "nomeMorador" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "celular" TEXT NOT NULL DEFAULT '',
  "dataEntrada" TIMESTAMP(3) NOT NULL,
  "dataSaida" TIMESTAMP(3),

  CONSTRAINT "HistoricoMorador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricoMorador_unidadeId_idx" ON "HistoricoMorador"("unidadeId");
CREATE INDEX IF NOT EXISTS "HistoricoMorador_unidadeId_dataEntrada_idx" ON "HistoricoMorador"("unidadeId", "dataEntrada");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HistoricoMorador_unidadeId_fkey'
  ) THEN
    ALTER TABLE "HistoricoMorador"
      ADD CONSTRAINT "HistoricoMorador_unidadeId_fkey"
      FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "HistoricoMorador" (
  "id", "unidadeId", "nomeMorador", "email", "celular", "dataEntrada", "dataSaida"
)
SELECT
  md5(random()::text || clock_timestamp()::text || u.id),
  u.id,
  u."nomeMorador",
  '',
  u.celular,
  u."createdAt",
  NULL
FROM "Unidade" u
WHERE TRIM(u."nomeMorador") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "HistoricoMorador" h
    WHERE h."unidadeId" = u.id
      AND h."dataSaida" IS NULL
  );
