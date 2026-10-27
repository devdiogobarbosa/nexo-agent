import { NextResponse } from "next/server";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

export async function GET() {
  try {
    const user = await requireRole("funcionario");
    const { conversations, tickets } = await services();
    const conversation = await conversations.getOrCreateForEmployee(user.id);
    const [thread, mine] = await Promise.all([
      conversations.listMessages(conversation.id),
      tickets.listByRequester(user.id),
    ]);
    return NextResponse.json({ conversation, messages: thread, tickets: mine });
  } catch (error) {
    return jsonError(error);
  }
}
