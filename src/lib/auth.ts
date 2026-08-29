import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "sessao";

export type SessionUser = {
  sub: string;
  nome: string;
  email: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ nome: user.nome, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (!payload.sub || typeof payload.nome !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      nome: payload.nome,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function getApiSession(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!token) {
    return null;
  }

  return verifySessionToken(decodeURIComponent(token));
}

export async function requireApiSession(request: Request) {
  const session = await getApiSession(request);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  return { session, error: null };
}
