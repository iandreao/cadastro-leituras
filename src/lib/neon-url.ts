export function normalizarDatabaseUrl(urlBruta: string) {
  let url = urlBruta.trim();
  url = url.replace(/^DATABASE_URL\s*=\s*/i, "").trim();
  url = url.replace(/^["']+|["']+$/g, "").trim();

  if (!/^postgres(ql)?:\/\//i.test(url)) {
    url = `postgresql://${url}`;
  }

  return url;
}

function hostnamePooler(hostname: string) {
  if (!hostname.includes("neon.tech") || hostname.includes("-pooler.")) {
    return hostname;
  }

  return hostname.replace(/^([^.]+)(\.)/, "$1-pooler$2");
}

function aplicarParamsPooler(params: URLSearchParams) {
  params.set("sslmode", "require");
  params.set("pgbouncer", "true");
  params.set("connect_timeout", "15");
  params.set("connection_limit", "1");
  params.set("pool_timeout", "10");
  params.delete("channel_binding");
}

export function urlNeonComPoolerESsl(urlBruta: string) {
  const url = normalizarDatabaseUrl(urlBruta);

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("neon.tech")) {
      parsed.hostname = hostnamePooler(parsed.hostname);
      aplicarParamsPooler(parsed.searchParams);
    }

    return parsed.toString();
  } catch {
    const semProtocolo = url.replace(/^postgres(?:ql)?:\/\//i, "");
    const at = semProtocolo.lastIndexOf("@");
    const credenciais = at >= 0 ? semProtocolo.slice(0, at) : "";
    const resto = at >= 0 ? semProtocolo.slice(at + 1) : semProtocolo;
    const barra = resto.indexOf("/");
    const hostPorta = barra >= 0 ? resto.slice(0, barra) : resto;
    const caminhoEQuery = barra >= 0 ? resto.slice(barra) : "/neondb";
    const [caminho, query = ""] = caminhoEQuery.split("?");
    const hostOriginal = hostPorta.split(":")[0] ?? hostPorta;
    const host = hostnamePooler(hostOriginal);
    const params = new URLSearchParams(query);

    if (host.includes("neon.tech")) {
      aplicarParamsPooler(params);
    }

    const userinfo = credenciais ? `${credenciais}@` : "";
    return `postgresql://${userinfo}${host}${caminho || "/neondb"}?${params.toString()}`;
  }
}
