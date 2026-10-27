import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  affectedScopes,
  categories,
  priorities,
  ticketTypes,
  type AffectedScope,
  type Category,
  type Priority,
  type TicketType,
} from "@/lib/domain";
import { TicketUnavailableError } from "@/lib/errors";
import { searchArticles } from "@/server/knowledge/search";
import { services } from "@/server/services";
import { deadlineFor, formatDeadline, isOverdue } from "@/server/sla/business-time";
import { withTicketRetry } from "@/server/tickets/service";
import type { RuntimeContext } from "@mastra/core/runtime-context";

function employeeId(runtimeContext: RuntimeContext) {
  const value = runtimeContext.get("employeeId");
  if (typeof value !== "string" || value.length === 0) throw new Error("Funcionário ausente no contexto.");
  return value;
}

async function readTickets(runtimeContext: RuntimeContext) {
  const { tickets } = await services();
  const requesterId = employeeId(runtimeContext);
  return {
    requesterId,
    tickets: await withTicketRetry(() => tickets.listByRequester(requesterId)),
  };
}

export const buscarCentralDeAjuda = createTool({
  id: "buscarCentralDeAjuda",
  description: "Busca artigos curtos da central de ajuda. Informe a versão do Windows quando o problema for de computador.",
  inputSchema: z.object({
    query: z.string().describe("Sintoma ou palavras do funcionário"),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { db } = await services();
    const { articles } = await import("@/server/db/schema");
    const rows = await db.select().from(articles);
    const windowsVersion = runtimeContext.get("windowsVersion");
    const matches = searchArticles(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        tags: row.tags.split(","),
        windowsVersion: row.windowsVersion,
      })),
      context.query,
      typeof windowsVersion === "string" ? windowsVersion : null,
    );
    return {
      articles: matches.slice(0, 3).map((article) => ({
        id: article.id,
        title: article.title,
        body: article.body,
        tags: article.tags,
        windowsVersion: article.windowsVersion,
      })),
    };
  },
});

export const listarMeusChamados = createTool({
  id: "listarMeusChamados",
  description: "Lista apenas os chamados do funcionário autenticado.",
  inputSchema: z.object({}),
  execute: async ({ runtimeContext }) => {
    try {
      const { tickets } = await readTickets(runtimeContext);
      const open = tickets.filter((ticket) => ticket.status !== "resolvido");
      return { tickets, askWhich: open.length > 1 };
    } catch (error) {
      if (error instanceof TicketUnavailableError) {
        return { unavailable: true, message: error.message, tickets: [] };
      }
      throw error;
    }
  },
});

export const consultarChamado = createTool({
  id: "consultarChamado",
  description: "Consulta um chamado do funcionário autenticado pelo número.",
  inputSchema: z.object({ ticketId: z.string() }),
  execute: async ({ context, runtimeContext }) => {
    const { tickets: service } = await services();
    const ticket = await withTicketRetry(() => service.getForRequester(employeeId(runtimeContext), context.ticketId));
    return { ticket, overdue: ticket.status !== "resolvido" && isOverdue(ticket.dueAt) };
  },
});

export const calcularPrazo = createTool({
  id: "calcularPrazo",
  description: "Calcula o prazo da prioridade a partir de agora, em horário de São Paulo.",
  inputSchema: z.object({ priority: z.enum(priorities) }),
  execute: async ({ context }) => {
    const due = deadlineFor(context.priority, new Date());
    return { priority: context.priority, dueAt: due.toISOString(), label: formatDeadline(due) };
  },
});

export const prepararRascunho = createTool({
  id: "prepararRascunho",
  description: "Monta um rascunho de chamado ou de atualização. Não grava nada. Use existingTicketId para atualizar um chamado aberto.",
  inputSchema: z.object({
    type: z.enum(ticketTypes),
    title: z.string(),
    description: z.string(),
    category: z.enum(categories),
    priority: z.enum(priorities),
    affectedScope: z.enum(affectedScopes),
    existingTicketId: z.string().nullable(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { tickets: service } = await services();
    const requesterId = employeeId(runtimeContext);
    if (!context.existingTicketId) {
      const similar = await service.findOpenSimilar(requesterId, context.category, context.title);
      if (similar) {
        return {
          duplicate: true,
          ticket: similar,
          message: `Já existe ${similar.id} aberto sobre o mesmo problema. Atualize esse chamado.`,
        };
      }
    }
    const due = deadlineFor(context.priority, new Date());
    return {
      draft: {
        type: context.type as TicketType,
        title: context.title,
        description: context.description,
        category: context.category as Category,
        priority: context.priority as Priority,
        affectedScope: context.affectedScope as AffectedScope,
        existingTicketId: context.existingTicketId,
        dueAt: due.toISOString(),
        dueLabel: formatDeadline(due),
      },
    };
  },
});

export const proporTransferencia = createTool({
  id: "proporTransferencia",
  description: "Oferece falar com um analista. Não transfere sozinho, a não ser que userAskedAnalyst esteja no contexto.",
  inputSchema: z.object({
    summary: z.string(),
    reason: z.string(),
    confidence: z.number(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const asked = runtimeContext.get("userAskedAnalyst") === true;
    return {
      summary: context.summary,
      reason: context.reason,
      confidence: context.confidence,
      transferNow: asked,
      options: asked
        ? []
        : [
            { id: "transfer", label: "Falar com um analista" },
            { id: "add_info", label: "Adicionar informação" },
            { id: "decline", label: "Não, obrigado" },
          ],
    };
  },
});

export const nexoTools = {
  buscarCentralDeAjuda,
  listarMeusChamados,
  consultarChamado,
  calcularPrazo,
  prepararRascunho,
  proporTransferencia,
};
