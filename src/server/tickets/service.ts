import { and, eq } from "drizzle-orm";
import {
  categories,
  openTicketStatuses,
  priorities,
  ticketStatuses,
  ticketTypes,
  type AffectedScope,
  type Category,
  type Priority,
  type Ticket,
  type TicketStatus,
  type TicketType,
  affectedScopes,
} from "@/lib/domain";
import {
  DuplicateTicketError,
  ForbiddenTicketError,
  NotFoundError,
  ReopenWindowError,
  TicketUnavailableError,
} from "@/lib/errors";
import type { Database } from "@/server/db/client";
import { tickets } from "@/server/db/schema";
import { deadlineFor } from "@/server/sla/business-time";

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.34;

type TicketRow = typeof tickets.$inferSelect;

export type NewTicketInput = {
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  requesterId: string;
  affectedScope: AffectedScope;
  now?: Date;
};

export type TicketPatch = {
  title?: string;
  description?: string;
  note?: string;
  priority?: Priority;
  category?: Category;
  status?: TicketStatus;
};

type ServiceOptions = {
  failureRate?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

function oneOf<T extends string>(values: readonly T[], value: string, label: string): T {
  if (values.includes(value as T)) return value as T;
  throw new Error(`${label} inválida: ${value}`);
}

export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    type: oneOf(ticketTypes, row.type, "Tipo"),
    title: row.title,
    description: row.description,
    category: oneOf(categories, row.category, "Categoria"),
    priority: oneOf(priorities, row.priority, "Prioridade"),
    status: oneOf(ticketStatuses, row.status, "Status"),
    requesterId: row.requesterId,
    affectedScope: oneOf(affectedScopes, row.affectedScope, "Abrangência"),
    openedAt: row.openedAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    dueAt: row.dueAt,
    assigneeId: row.assigneeId,
    lastEvent: row.lastEvent,
  };
}

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function tokenSet(value: string) {
  return new Set(fold(value).split(/[^a-z0-9]+/).filter((token) => token.length > 3));
}

export function titleSimilarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

async function nextTicketId(db: Database, type: TicketType) {
  const rows = await db.select({ id: tickets.id }).from(tickets);
  const prefix = `${type}-`;
  const highest = rows.reduce((max, row) => {
    if (!row.id.startsWith(prefix)) return max;
    const value = Number(row.id.slice(prefix.length));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, type === "INC" ? 20000 : 10000);
  return `${prefix}${highest + 1}`;
}

export function createTicketService(db: Database, options: ServiceOptions = {}) {
  const failureRate = options.failureRate ?? Number(process.env.TICKET_FAILURE_RATE ?? "0");
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function gate() {
    if (failureRate > 0 && random() < failureRate) {
      await sleep(250);
      throw new TicketUnavailableError();
    }
  }

  async function listByRequester(requesterId: string) {
    await gate();
    const rows = await db.select().from(tickets).where(eq(tickets.requesterId, requesterId));
    return rows.map(toTicket).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async function getById(ticketId: string) {
    await gate();
    const rows = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    const row = rows[0];
    if (!row) throw new NotFoundError(`Chamado ${ticketId} não encontrado.`);
    return toTicket(row);
  }

  async function getForRequester(requesterId: string, ticketId: string) {
    const ticket = await getById(ticketId);
    if (ticket.requesterId !== requesterId) throw new ForbiddenTicketError();
    return ticket;
  }

  async function findOpenSimilar(requesterId: string, category: Category, title: string) {
    const mine = await listByRequester(requesterId);
    return (
      mine.find(
        (ticket) =>
          openTicketStatuses.includes(ticket.status as (typeof openTicketStatuses)[number]) &&
          ticket.category === category &&
          titleSimilarity(ticket.title, title) >= SIMILARITY_THRESHOLD,
      ) ?? null
    );
  }

  async function create(input: NewTicketInput) {
    const similar = await findOpenSimilar(input.requesterId, input.category, input.title);
    if (similar) throw new DuplicateTicketError(similar.id);
    const now = input.now ?? new Date();
    const id = await nextTicketId(db, input.type);
    const dueAt = deadlineFor(input.priority, now).toISOString();
    const timestamp = now.toISOString();
    await db.insert(tickets).values({
      id,
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "aberto",
      requesterId: input.requesterId,
      affectedScope: input.affectedScope,
      openedAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: null,
      dueAt,
      assigneeId: null,
      lastEvent: "Chamado aberto depois da confirmação do funcionário",
    });
    return getById(id);
  }

  async function update(requesterId: string, ticketId: string, patch: TicketPatch, now = new Date()) {
    const current = await getForRequester(requesterId, ticketId);
    const priority = patch.priority ?? current.priority;
    const dueAt =
      patch.priority && patch.priority !== current.priority
        ? deadlineFor(priority, now).toISOString()
        : current.dueAt;
    const description = patch.note
      ? `${current.description}\n\nAtualização: ${patch.note}`
      : (patch.description ?? current.description);
    await db
      .update(tickets)
      .set({
        title: patch.title ?? current.title,
        description,
        category: patch.category ?? current.category,
        priority,
        status: patch.status ?? current.status,
        dueAt,
        updatedAt: now.toISOString(),
        lastEvent: patch.note ?? "Chamado atualizado depois da confirmação do funcionário",
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.requesterId, requesterId)));
    return getById(ticketId);
  }

  async function reopen(requesterId: string, ticketId: string, note: string, now = new Date()) {
    const current = await getForRequester(requesterId, ticketId);
    if (current.status !== "resolvido" || !current.resolvedAt) {
      throw new NotFoundError("Só um chamado resolvido pode ser reaberto.");
    }
    if (now.getTime() - new Date(current.resolvedAt).getTime() > REOPEN_WINDOW_MS) {
      throw new ReopenWindowError();
    }
    const dueAt = deadlineFor(current.priority, now).toISOString();
    await db
      .update(tickets)
      .set({
        status: "aberto",
        resolvedAt: null,
        dueAt,
        updatedAt: now.toISOString(),
        description: `${current.description}\n\nReaberto: ${note}`,
        lastEvent: "Chamado reaberto dentro de 7 dias",
      })
      .where(eq(tickets.id, ticketId));
    return getById(ticketId);
  }

  async function transfer(ticketId: string, summary: string, now = new Date()) {
    const current = await getById(ticketId);
    await db
      .update(tickets)
      .set({
        status: "aguardando_analista",
        updatedAt: now.toISOString(),
        lastEvent: summary,
      })
      .where(eq(tickets.id, ticketId));
    return { ...current, status: "aguardando_analista" as const, lastEvent: summary, updatedAt: now.toISOString() };
  }

  return {
    listByRequester,
    getForRequester,
    findOpenSimilar,
    create,
    update,
    reopen,
    transfer,
  };
}

export async function withTicketRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof TicketUnavailableError)) throw error;
    return operation();
  }
}
