import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/server/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";
  const isEmployeeArea = pathname.startsWith("/atendimento") || pathname.startsWith("/perfil");
  const isConsole = pathname.startsWith("/console");

  if (!user && (isEmployeeArea || isConsole)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL(user.role === "analista" ? "/console" : "/atendimento", request.url));
  }

  if (user?.role === "funcionario" && isConsole) {
    return NextResponse.redirect(new URL("/atendimento", request.url));
  }

  if (user?.role === "analista" && isEmployeeArea) {
    return NextResponse.redirect(new URL("/console", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/atendimento/:path*", "/perfil/:path*", "/console/:path*"],
};
