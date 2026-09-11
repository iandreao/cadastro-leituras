-- Aditivo: status ativo/inativo na tabela de usuários (login e gestão).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;
