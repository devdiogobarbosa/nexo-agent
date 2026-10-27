import { z } from "zod";
import { AppError } from "@/lib/errors";
import { buildReply } from "@/server/agent/reply";
import { wantsAnalyst } from "@/server/agent/policy";
import { findUserById } from "@/server/auth/users";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

export const runtime = "nodejs";
export const maxDuration = 60;

const messageSchema = z.object({
  text: z.string().trim().min(1, "Escreva uma mensagem.").max(2000),
  action: z.string().optional(),
});

function streamResponse(produce: (send: (event: unknown) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await produce(send);
        send({ type: "done" });
      } catch (error) {
        const message = error instanceof AppError ? error.message : "O Nexo Assist não conseguiu responder agora.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("funcionario");
    const body: unknown = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Mensagem inválida." }, { status: 400 });
    }
    const person = await findUserById(user.id);
    const { conversations, tickets, db } = await services();
    const conversation = await conversations.getOrCreateForEmployee(user.id);
    await conversations.addMessage(conversation.id, {
      role: "user",
      authorName: user.name,
      text: parsed.data.text,
    });
    const updated = await conversations.requireConversation(conversation.id);

    if (updated.state !== "com_agent") {
      return Response.json({ paused: true, conversation: updated });
    }

    if (wantsAnalyst(parsed.data.text, parsed.data.action)) {
      const summary = `O funcionário pediu um analista. Última mensagem: ${parsed.data.text}`;
      await conversations.markWaiting(conversation.id, summary);
      await conversations.addMessage(conversation.id, {
        role: "assistant",
        authorName: "Nexo Assist",
        text: "Encaminhei para o Suporte N2. Um analista vai falar com você. Eu fico pausado enquanto isso.",
        decision: {
          understanding: parsed.data.text,
          action: "Transferir para o analista",
          confidence: 0.9,
          reason: "O funcionário pediu atendimento humano.",
          tools: [{ id: "proporTransferencia", label: "sugeriu transferência" }],
        },
      });
      await conversations.addMessage(conversation.id, {
        role: "system",
        authorName: "Sistema",
        text: "Transferida para Suporte N2",
      });
      const open = (await tickets.listByRequester(user.id)).find((ticket) => ticket.status !== "resolvido");
      if (open) await tickets.transfer(open.id, summary);
      return Response.json({ paused: true, transferred: true });
    }

    return streamResponse(async (send) => {
      let reply;
      try {
        reply = await buildReply({
          db,
          conversationId: conversation.id,
          employeeId: user.id,
          windowsVersion: person?.windowsVersion ?? null,
          userAskedAnalyst: false,
          history: await conversations.listMessages(conversation.id),
          onText: (delta) => send({ type: "text", delta }),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "MODELO_AUSENTE") {
          throw new AppError(
            "MODEL_MISSING",
            "O modelo não está configurado. Defina a chave do provedor no ambiente e o LLM_MODEL.",
          );
        }
        throw error;
      }
      await conversations.addMessage(conversation.id, {
        role: "assistant",
        authorName: "Nexo Assist",
        text: reply.text,
        decision: reply.decision,
        payload: { cards: reply.cards },
      });
      send({ type: "decision", decision: reply.decision });
    });
  } catch (error) {
    return jsonError(error);
  }
}
