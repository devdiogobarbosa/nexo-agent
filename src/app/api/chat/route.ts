import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

const messageSchema = z.object({
  text: z.string().trim().min(1, "Escreva uma mensagem.").max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireRole("funcionario");
    const body: unknown = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Mensagem inválida." }, { status: 400 });
    }
    const { conversations } = await services();
    const conversation = await conversations.getOrCreateForEmployee(user.id);
    const message = await conversations.addMessage(conversation.id, {
      role: "user",
      authorName: user.name,
      text: parsed.data.text,
    });
    const updated = await conversations.requireConversation(conversation.id);
    return NextResponse.json({
      message,
      conversation: updated,
      paused: updated.state !== "com_agent",
    });
  } catch (error) {
    return jsonError(error);
  }
}
