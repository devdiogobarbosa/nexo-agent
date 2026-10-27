import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { findUserById } from "@/server/auth/users";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
