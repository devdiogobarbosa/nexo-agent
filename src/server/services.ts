import { getDatabase } from "@/server/db/client";
import { createConversationService } from "@/server/conversations/service";
import { createTicketService } from "@/server/tickets/service";

export async function services() {
  const db = await getDatabase();
  return {
    db,
    tickets: createTicketService(db),
    conversations: createConversationService(db),
  };
}
