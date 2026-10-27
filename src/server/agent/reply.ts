import { RuntimeContext } from "@mastra/core/runtime-context";
import type { ChatCard, DecisionTrace, Ticket } from "@/lib/domain";
import type { Database } from "@/server/db/client";
import { drafts } from "@/server/db/schema";
import { labelForTool, splitDecision, withTools } from "@/server/agent/trace";
import { modelConfigured, nexoAgent } from "@/server/agent/nexo-agent";
import type { StoredMessage } from "@/server/conversations/service";
import { type DraftPayload } from "@/server/drafts/confirm";
import { isOverdue } from "@/server/sla/business-time";
import { z } from "zod";
import { affectedScopes, categories, priorities, ticketTypes } from "@/lib/domain";

const draftSchema = z.object({
  type: z.enum(ticketTypes),
  title: z.string(),
  description: z.string(),
  category: z.enum(categories),
  priority: z.enum(priorities),
  affectedScope: z.enum(affectedScopes),
  existingTicketId: z.string().nullable(),
  dueAt: z.string(),
  dueLabel: z.string(),
});

type ToolResult = {
  toolName: string;
  result: Record<string, unknown>;
};

export type AgentReply = {
  text: string;
  decision: DecisionTrace;
  cards: ChatCard[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTicket(value: unknown): Ticket | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || typeof record.title !== "string") return null;
  return record as Ticket;
}

function ticketCard(ticket: Ticket): ChatCard {
  return { kind: "ticket", ticket, overdue: ticket.status !== "resolvido" && isOverdue(ticket.dueAt) };
}

export async function buildReply(input: {
  db: Database;
  conversationId: string;
  employeeId: string;
  windowsVersion: string | null;
  userAskedAnalyst: boolean;
  history: StoredMessage[];
  onText: (delta: string) => void;
}): Promise<AgentReply> {
  if (!modelConfigured()) throw new Error("MODELO_AUSENTE");
  const runtimeContext = new RuntimeContext();
  runtimeContext.set("employeeId", input.employeeId);
  runtimeContext.set("windowsVersion", input.windowsVersion);
  runtimeContext.set("userAskedAnalyst", input.userAskedAnalyst);
  const transcript = input.history
    .slice(-10)
    .map((message) => {
      const author = message.role === "assistant" || message.role === "analyst" ? "Nexo" : message.role === "system" ? "Sistema" : "Funcionário";
      return `${author}: ${message.text}`;
    })
    .join("\n");
  const stream = await nexoAgent().stream(transcript || "Olá", { maxSteps: 5, runtimeContext });
  let raw = "";
  let held = "";
  for await (const chunk of stream.textStream) {
    held += chunk;
    const marker = held.indexOf("<decisao>");
    if (marker === -1) {
      const safe = held.length > 12 ? held.slice(0, -12) : "";
      if (safe) {
        input.onText(safe);
        raw += safe;
        held = held.slice(safe.length);
      }
      continue;
    }
    const before = held.slice(0, marker);
    if (before) input.onText(before);
    raw += held;
    held = "";
  }
  raw += held;
  const toolResults: ToolResult[] = (await stream.toolResults).map((item) => ({
    toolName: item.payload.toolName,
    result: asRecord(item.payload.result) ?? {},
  }));
  const { visible, decision } = splitDecision(raw);
  const cards = await cardsFromTools(input.db, input.conversationId, input.employeeId, toolResults);
  const tools = toolResults.map((item) => {
    const ticket = asTicket(item.result.ticket);
    return { id: item.toolName, label: labelForTool(item.toolName, ticket?.id) };
  });
  const uniqueTools = tools.filter((tool, index) => tools.findIndex((item) => item.label === tool.label) === index);
  return {
    text: visible || "Não consegui formular a resposta. Pode repetir com um pouco mais de detalhe?",
    decision: withTools(decision, uniqueTools, input.history.at(-1)?.text ?? "Mensagem do funcionário"),
    cards,
  };
}

async function cardsFromTools(db: Database, conversationId: string, employeeId: string, results: ToolResult[]) {
  const cards: ChatCard[] = [];
  for (const item of results) {
    const tickets = Array.isArray(item.result.tickets) ? item.result.tickets.map(asTicket).filter((ticket) => ticket !== null) : [];
    if (item.toolName === "listarMeusChamados" && item.result.askWhich === true && tickets.length > 0) {
      cards.push({ kind: "selector", tickets });
    }
    const single = asTicket(item.result.ticket);
    if ((item.toolName === "consultarChamado" || item.result.duplicate === true) && single) {
      cards.push(ticketCard(single));
    }
    const parsed = draftSchema.safeParse(item.result.draft);
    if (item.toolName === "prepararRascunho" && parsed.success) {
      const id = crypto.randomUUID();
      const payload: DraftPayload = {
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        priority: parsed.data.priority,
        affectedScope: parsed.data.affectedScope,
        existingTicketId: parsed.data.existingTicketId,
      };
      await db.insert(drafts).values({
        id,
        conversationId,
        employeeId,
        payloadJson: JSON.stringify(payload),
        status: "pendente",
        resultingTicketId: null,
        createdAt: new Date().toISOString(),
      });
      cards.push({ kind: "draft", draftId: id, dueLabel: parsed.data.dueLabel, ...payload });
    }
    if (item.toolName === "proporTransferencia" && Array.isArray(item.result.options)) {
      const options = item.result.options.flatMap((option) => {
        const record = asRecord(option);
        if (!record || typeof record.id !== "string" || typeof record.label !== "string") return [];
        return [{ id: record.id, label: record.label }];
      });
      if (options.length > 0) cards.push({ kind: "options", options });
    }
  }
  return cards;
}
