import { eq } from "drizzle-orm";
import type { Role, User } from "@/lib/domain";
import { getDatabase } from "@/server/db/client";
import { users } from "@/server/db/schema";

function asRole(value: string): Role {
  if (value === "funcionario" || value === "analista") return value;
  throw new Error(`Papel inválido: ${value}`);
}

export function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: asRole(row.role),
    department: row.department,
    initials: row.initials,
    windowsVersion: row.windowsVersion,
    passwordChangedAt: row.passwordChangedAt,
  };
}

export async function findUserByEmail(email: string) {
  const db = await getDatabase();
  const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function findUserById(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(users).where(eq(users.id, id));
  const row = rows[0];
  return row ? toUser(row) : null;
}
