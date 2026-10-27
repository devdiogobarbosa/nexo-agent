import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/domain";

export const SESSION_COOKIE = "nexo_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new AppError("CONFIG", "Defina SESSION_SECRET no ambiente antes de entrar.");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser, remember: boolean) {
  return new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(remember ? "30d" : "12h")
    .sign(sessionSecret());
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub || (payload.role !== "funcionario" && payload.role !== "analista")) return null;
    if (typeof payload.name !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  };
}
