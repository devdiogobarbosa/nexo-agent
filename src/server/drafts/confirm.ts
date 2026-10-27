import { eq } from "drizzle-orm";
import { z } from "zod";
import { affectedScopes, categories, priorities, ticketTypes } from "@/lib/domain";
import { AppError, DuplicateTicketError, ForbiddenTicketError } from "@/lib/errors";
import type { Database } from "@/server/db/client";
import { drafts } from "@/server/db/schema";
import { createTicketService } from "@/server/tickets/service";

const draftSchema = z.object({
  type: z.enum(ticketTypes),
  title: z.string().trim().min(3),
  description: z.string().trim().min(3),
  category: z.enum(categories),
  priority: z.enum(priorities),
  affectedScope: z.enum(affectedScopes),
  existingTicketId: z.string().nullable(),
});

export type DraftPayload = z.infer<typeof draftSchema>;

export async function confirmDraft(db: Database, employeeId: string, draftId: string, edits?: Partial<DraftPayload>) {
  const rows = await db.select().from(drafts).where(eq(drafts.id, draftId));
  const draft = rows[0];
  if (!draft) throw new AppError("NOT_FOUND", "Rascunho não encontrado.");
  if (draft.employeeId !== employeeId) throw new ForbiddenTicketError();
  if (draft.status !== "pendente") throw new AppError("DRAFT_CLOSED", "Esse rascunho já foi confirmado ou cancelado.");
  const overrides = Object.fromEntries(Object.entries(edits ?? {}).filter(([, value]) => value !== undefined));
  const payload = draftSchema.parse({ ...(JSON.parse(draft.payloadJson) as DraftPayload), ...overrides });
  const service = createTicketService(db, { failureRate: 0 });
  let ticket;
  if (payload.existingTicketId) {
    const current = await service.getForRequester(employeeId, payload.existingTicketId);
    ticket =
      current.status === "resolvido"
        ? await service.reopen(employeeId, current.id, payload.description)
        : await service.update(employeeId, current.id, {
            title: payload.title,
            description: payload.description,
            category: payload.category,
            priority: payload.priority,
          });
  } else {
    try {
      ticket = await service.create({
        type: payload.type,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        priority: payload.priority,
        affectedScope: payload.affectedScope,
        requesterId: employeeId,
      });
    } catch (error) {
      if (!(error instanceof DuplicateTicketError)) throw error;
      ticket = await service.update(employeeId, error.ticketId, { note: payload.description });
    }
  }
  await db
    .update(drafts)
    .set({ status: "confirmado", resultingTicketId: ticket.id })
    .where(eq(drafts.id, draftId));
  return ticket;
}

export async function cancelDraft(db: Database, employeeId: string, draftId: string) {
  const rows = await db.select().from(drafts).where(eq(drafts.id, draftId));
  const draft = rows[0];
  if (!draft || draft.employeeId !== employeeId) throw new ForbiddenTicketError();
  await db.update(drafts).set({ status: "cancelado" }).where(eq(drafts.id, draftId));
}
