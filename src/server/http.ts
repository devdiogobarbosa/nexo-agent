import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    const status =
      error.code === "UNAUTHORIZED" ? 401
      : error.code === "FORBIDDEN" || error.code === "FORBIDDEN_TICKET" ? 403
      : error.code === "NOT_FOUND" ? 404
      : error.code === "SESSION_LIMIT" || error.code === "DAILY_CAP" ? 429
      : error.code === "TICKET_UNAVAILABLE" ? 503
      : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Entre para continuar.");
  return user;
}

export async function requireRole(role: SessionUser["role"]) {
  const user = await requireUser();
  if (user.role !== role) {
    throw new AppError("FORBIDDEN", role === "analista" ? "Área restrita ao service desk." : "Área restrita ao funcionário.");
  }
  return user;
}
