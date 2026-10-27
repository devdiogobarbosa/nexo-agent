import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { findUserByEmail } from "@/server/auth/users";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";

const loginSchema = z.object({
  email: z.string().trim().min(3, "Informe o e-mail corporativo."),
  password: z.string().min(1, "Informe a senha."),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      return NextResponse.json({ error: "E-mail não encontrado na Nexo." }, { status: 401 });
    }
    const token = await signSession(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      parsed.data.remember ?? false,
    );
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(parsed.data.remember ?? false));
    return response;
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Não foi possível entrar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
