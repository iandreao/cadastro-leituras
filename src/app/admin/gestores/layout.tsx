import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function GestoresAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session?.role !== "SUPER_ADMIN") {
    redirect("/admin/usuarios");
  }

  return children;
}
