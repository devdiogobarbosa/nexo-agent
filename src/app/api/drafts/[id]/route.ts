import { z } from "zod";
import { affectedScopes, categories, priorities, statusLabels, ticketTypes } from "@/lib/domain";
import { cancelDraft, confirmDraft } from "@/server/drafts/confirm";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

const editSchema = z.object({
  action: z.enum(["confirmar", "cancelar"]),
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().min(3).optional(),
  category: z.enum(categories).optional(),
  priority: z.enum(priorities).optional(),
  affectedScope: z.enum(affectedScopes).optional(),
  type: z.enum(ticketTypes).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireRole("funcionario");
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Não foi possível ler o rascunho." }, { status: 400 });
    const { db, conversations } = await services();
    const conversation = await conversations.getOrCreateForEmployee(user.id);
    if (parsed.data.action === "cancelar") {
      await cancelDraft(db, user.id, id);
      await conversations.addMessage(conversation.id, {
        role: "assistant",
        authorName: "Nexo Assist",
        text: "Cancelei o rascunho. Nada foi gravado no sistema de chamados.",
      });
      return Response.json({ ok: true });
    }
    const ticket = await confirmDraft(db, user.id, id, {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      affectedScope: parsed.data.affectedScope,
      type: parsed.data.type,
    });
    await conversations.addMessage(conversation.id, {
      role: "assistant",
      authorName: "Nexo Assist",
      text: `Confirmei o ${ticket.id}. Status: ${statusLabels[ticket.status]}.`,
      decision: {
        understanding: ticket.title,
        action: "Gravar o chamado depois da confirmação",
        confidence: 1,
        reason: "O funcionário confirmou o rascunho. A gravação não depende do modelo.",
        tools: [{ id: "confirmarRascunho", label: "gravou o chamado confirmado" }],
      },
    });
    return Response.json({ ticket });
  } catch (error) {
    return jsonError(error);
  }
}
