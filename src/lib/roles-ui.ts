import type { RoleSessao } from "@/lib/auth";

export const ROTULO_ROLE: Record<RoleSessao, string> = {
  SUPER_ADMIN: "Super Admin",
  GESTOR_ADMIN: "Gestor",
  OPERADOR: "Operador",
};

export const CLASSE_TAG_ROLE: Record<RoleSessao, string> = {
  SUPER_ADMIN: "bg-purple-200 text-purple-900",
  GESTOR_ADMIN: "bg-blue-200 text-blue-900",
  OPERADOR: "bg-emerald-200 text-slate-800",
};

export function rotuloRole(role: string) {
  if (role === "SUPER_ADMIN" || role === "GESTOR_ADMIN" || role === "OPERADOR") {
    return ROTULO_ROLE[role];
  }

  return role;
}

export function classeTagRole(role: string) {
  if (role === "SUPER_ADMIN" || role === "GESTOR_ADMIN" || role === "OPERADOR") {
    return CLASSE_TAG_ROLE[role];
  }

  return CLASSE_TAG_ROLE.OPERADOR;
}
