import { redirect } from "next/navigation";
import { ConsoleBoard, type ConsoleListItem } from "@/components/console/console-board";
import { findUserById } from "@/server/auth/users";
import { getCurrentUser } from "@/server/auth/session";
import { services } from "@/server/services";
import { isOverdue } from "@/server/sla/business-time";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string; filtro?: string; q?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "analista") redirect("/atendimento");
  const params = await searchParams;
  const filter = params.filtro ?? "todas";
  const query = params.q ?? "";
  const { conversations, tickets } = await services();
  const items = await conversations.listForAnalyst(session.id, filter, query);
  const selectedId = params.conversa ?? items[0]?.id;
  let selected = null;
  if (selectedId) {
    const conversation = await conversations.requireConversation(selectedId);
    const [messages, employee, employeeTickets] = await Promise.all([
      conversations.listMessages(selectedId),
      findUserById(conversation.employeeId),
      tickets.listByRequester(conversation.employeeId),
    ]);
    selected = {
      conversationId: conversation.id,
      state: conversation.state as ConsoleListItem["state"],
      assigneeId: conversation.assigneeId,
      analystId: session.id,
      employee,
      messages,
      tickets: employeeTickets.map((ticket) => ({
        ...ticket,
        overdue: ticket.status !== "resolvido" && isOverdue(ticket.dueAt),
      })),
    };
  }

  return (
    <ConsoleBoard
      analystName={session.name}
      items={items}
      filter={filter}
      query={query}
      selected={selected}
    />
  );
}
