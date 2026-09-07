export const NEON_POOLER_HOST =
  "ep-small-pine-acq5tmp9-pooler.sa-east-1.aws.neon.tech";

export function urlNeonComPoolerESsl(urlBruta: string) {
  const parsed = new URL(urlBruta.trim());
  parsed.hostname = NEON_POOLER_HOST;
  parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("channel_binding", "require");
  return parsed.toString();
}
