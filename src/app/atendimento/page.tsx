import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { EmployeeShell } from "@/components/layout/employee-shell";
import { findUserById } from "@/server/auth/users";
import { getCurrentUser } from "@/server/auth/session";
import { services } from "@/server/services";
import { isOverdue } from "@/server/sla/business-time";

export default async function AtendimentoPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "funcionario") redirect("/console");
  const user = await findUserById(session.id);
  if (!user) redirect("/login");
  const { conversations, tickets } = await services();
  const conversation = await conversations.getOrCreateForEmployee(user.id);
  const [messages, mine] = await Promise.all([
    conversations.listMessages(conversation.id),
    tickets.listByRequester(user.id),
  ]);

  return (
    <EmployeeShell user={user} current="atendimento">
      <ChatPanel
        messages={messages}
        sessionCount={conversation.sessionMessageCount}
        paused={conversation.state !== "com_agent"}
        tickets={mine.map((ticket) => ({
          ...ticket,
          overdue: ticket.status !== "resolvido" && isOverdue(ticket.dueAt),
        }))}
      />
    </EmployeeShell>
  );
}
