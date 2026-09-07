export const NEON_POOLER_HOST =
  "ep-small-pine-acq5tmp9-pooler.sa-east-1.aws.neon.tech";

export function normalizarDatabaseUrl(urlBruta: string) {
  let url = urlBruta.trim();
  url = url.replace(/^DATABASE_URL\s*=\s*/i, "").trim();
  url = url.replace(/^["']+|["']+$/g, "").trim();

  if (!/^postgres(ql)?:\/\//i.test(url)) {
    url = `postgresql://${url}`;
  }

  return url;
}

export function urlNeonComPoolerESsl(urlBruta: string) {
  const url = normalizarDatabaseUrl(urlBruta);

  try {
    const parsed = new URL(url);
    parsed.hostname = NEON_POOLER_HOST;
    parsed.searchParams.set("sslmode", "require");
    parsed.searchParams.set("channel_binding", "require");
    return parsed.toString();
  } catch {
    const semProtocolo = url.replace(/^postgres(?:ql)?:\/\//i, "");
    const at = semProtocolo.lastIndexOf("@");
    const credenciais = at >= 0 ? semProtocolo.slice(0, at) : "";
    const resto = at >= 0 ? semProtocolo.slice(at + 1) : semProtocolo;
    const barra = resto.indexOf("/");
    const caminhoEQuery = barra >= 0 ? resto.slice(barra) : "/neondb";
    const [caminho, query = ""] = caminhoEQuery.split("?");
    const params = new URLSearchParams(query);
    params.set("sslmode", "require");
    params.set("channel_binding", "require");
    const userinfo = credenciais ? `${credenciais}@` : "";
    return `postgresql://${userinfo}${NEON_POOLER_HOST}${caminho || "/neondb"}?${params.toString()}`;
  }
}
