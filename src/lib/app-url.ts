export function urlBaseApp() {
  const explicita =
    process.env.AUTH_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicita) {
    return explicita.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  return "http://localhost:3001";
}
