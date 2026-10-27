import Link from "next/link";
import { LogoutButton } from "@/components/layout/logout-button";
import type { User } from "@/lib/domain";

export function EmployeeShell({
  user,
  current,
  children,
}: {
  user: User;
  current: "atendimento" | "perfil";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-desk md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex items-center justify-between gap-4 border-b border-rule bg-paper px-4 py-4 md:flex-col md:items-stretch md:justify-between md:border-r md:border-b-0 md:px-5 md:py-6">
        <div>
          <p className="font-display text-2xl text-ink">Nexo Assist</p>
          <nav className="mt-4 flex gap-4 md:mt-8 md:flex-col md:gap-2">
            <Link
              href="/atendimento"
              className={current === "atendimento" ? "font-medium text-primary-text" : "text-ink-2"}
            >
              Atendimento
            </Link>
            <Link href="/perfil" className={current === "perfil" ? "font-medium text-primary-text" : "text-ink-2"}>
              Meu perfil
            </Link>
          </nav>
        </div>
        <div className="text-right md:text-left">
          <p className="font-medium text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-3">{user.email}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
