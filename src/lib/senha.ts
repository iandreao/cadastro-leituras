import bcrypt from "bcryptjs";

/** Fator 10: equilíbrio entre segurança e tempo de CPU no login (Neon/Vercel). */
export const BCRYPT_ROUNDS = 10;

export function hashSenha(senha: string) {
  return bcrypt.hash(senha, BCRYPT_ROUNDS);
}

export function senhaConfere(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}
