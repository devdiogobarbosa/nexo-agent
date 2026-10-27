import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { findUserById } from "@/server/auth/users";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

const actionSchema = z.object({
  action: z.enum(["assumir", "devolver", "encerrar", "mensagem"]),
  text: z.string().trim().max(2000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const analyst = await requireRole("analista");
    const { id } = await context.params;
    const { conversations, tickets } = await services();
    const conversation = await conversations.requireConversation(id);
    const [thread, employee, employeeTickets] = await Promise.all([
      conversations.listMessages(id),
      findUserById(conversation.employeeId),
      tickets.listByRequester(conversation.employeeId),
    ]);
    return NextResponse.json({ conversation, messages: thread, employee, tickets: employeeTickets, analystId: analyst.id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const analyst = await requireRole("analista");
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
    const { conversations } = await services();
    if (parsed.data.action === "assumir") await conversations.assume(id, analyst.id, analyst.name);
    if (parsed.data.action === "devolver") await conversations.release(id, analyst.id);
    if (parsed.data.action === "encerrar") await conversations.close(id, analyst.id);
    if (parsed.data.action === "mensagem") {
      if (!parsed.data.text) throw new AppError("VALIDATION", "Escreva a resposta para o funcionário.");
      const conversation = await conversations.requireConversation(id);
      if (conversation.state !== "em_atendimento" || conversation.assigneeId !== analyst.id) {
        throw new AppError("INVALID_STATE", "Assuma o atendimento para responder.");
      }
      await conversations.addMessage(id, { role: "analyst", authorName: analyst.name, text: parsed.data.text });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
