import { redirect } from "next/navigation";
import { EmployeeShell } from "@/components/layout/employee-shell";
import { formatDate } from "@/lib/format";
import { findUserById } from "@/server/auth/users";
import { getCurrentUser } from "@/server/auth/session";

export default async function PerfilPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "funcionario") redirect("/console");
  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  return (
    <EmployeeShell user={user} current="perfil">
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <p className="text-sm text-ink-3">Service desk de TI</p>
        <h1 className="mt-1 font-display text-4xl">Meu perfil</h1>
        <p className="mt-2 text-ink-2">Seus dados de acesso ao service desk de TI.</p>
        <dl className="mt-8 space-y-4 rounded-lg border border-rule bg-paper p-6">
          <div>
            <dt className="text-sm text-ink-3">Nome</dt>
            <dd className="text-lg">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-3">E-mail corporativo</dt>
            <dd className="text-lg">{user.email}</dd>
            <dd className="text-sm text-ink-3">Gerenciado pela TI</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-3">Área</dt>
            <dd>{user.department}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-3">Senha</dt>
            <dd>{user.passwordChangedAt ? `Alterada em ${formatDate(user.passwordChangedAt)}` : "Controlada pela rede Nexo"}</dd>
            <dd className="mt-2 text-sm text-ink-2">Para redefinir, ligue no ramal 4000. Este ambiente não envia e-mail.</dd>
          </div>
        </dl>
      </main>
    </EmployeeShell>
  );
}
