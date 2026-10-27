import { desc, eq } from "drizzle-orm";
import { SESSION_MESSAGE_LIMIT, type ConversationState, type DecisionTrace } from "@/lib/domain";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Database } from "@/server/db/client";
import { conversations, messages, users } from "@/server/db/schema";
import { wallClock } from "@/server/sla/business-time";

export type StoredMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "analyst" | "system";
  authorName: string;
  text: string;
  createdAt: string;
  decision: DecisionTrace | null;
  payload: unknown;
};

type ConversationRow = typeof conversations.$inferSelect;

function todayKey(now = new Date()) {
  const clock = wallClock(now);
  const month = String(clock.month).padStart(2, "0");
  const day = String(clock.day).padStart(2, "0");
  return `${clock.year}-${month}-${day}`;
}

function dailyCap() {
  const value = Number(process.env.DAILY_MESSAGE_CAP ?? "80");
  return Number.isFinite(value) && value > 0 ? value : 80;
}

function parseDecision(value: string | null): DecisionTrace | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as DecisionTrace;
    if (typeof parsed.understanding !== "string" || typeof parsed.action !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function toMessage(row: typeof messages.$inferSelect): StoredMessage {
  const role = row.role;
  if (role !== "user" && role !== "assistant" && role !== "analyst" && role !== "system") {
    throw new Error(`Papel de mensagem inválido: ${row.role}`);
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    role,
    authorName: row.authorName,
    text: row.text,
    createdAt: row.createdAt,
    decision: parseDecision(row.decisionJson),
    payload: row.payloadJson ? JSON.parse(row.payloadJson) : null,
  };
}

export function createConversationService(db: Database) {
  async function requireConversation(id: string) {
    const rows = await db.select().from(conversations).where(eq(conversations.id, id));
    const row = rows[0];
    if (!row) throw new NotFoundError("Conversa não encontrada.");
    return row;
  }

  async function getOrCreateForEmployee(employeeId: string, now = new Date()) {
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.employeeId, employeeId))
      .orderBy(desc(conversations.updatedAt));
    const current = rows[0];
    if (!current) {
      const created: ConversationRow = {
        id: crypto.randomUUID(),
        employeeId,
        state: "com_agent",
        assigneeId: null,
        sessionMessageCount: 0,
        dailyCount: 0,
        dailyDay: todayKey(now),
        summary: null,
        updatedAt: now.toISOString(),
        closedAt: null,
      };
      await db.insert(conversations).values(created);
      return created;
    }
    if (current.state === "encerrada") {
      const reopened = {
        ...current,
        state: "com_agent",
        assigneeId: null,
        sessionMessageCount: 0,
        closedAt: null,
        updatedAt: now.toISOString(),
      };
      await db
        .update(conversations)
        .set({
          state: reopened.state,
          assigneeId: null,
          sessionMessageCount: 0,
          closedAt: null,
          updatedAt: reopened.updatedAt,
        })
        .where(eq(conversations.id, current.id));
      return reopened;
    }
    return current;
  }

  async function listMessages(conversationId: string) {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return rows.map(toMessage);
  }

  async function assertCanSend(conversation: ConversationRow, role: StoredMessage["role"], now = new Date()) {
    const day = todayKey(now);
    const countToday = conversation.dailyDay === day ? conversation.dailyCount : 0;
    if (role === "user" && countToday >= dailyCap()) {
      throw new AppError(
        "DAILY_CAP",
        "O limite diário de mensagens foi atingido. Ele existe para evitar uso abusivo do modelo.",
      );
    }
    if (
      conversation.state === "com_agent" &&
      (role === "user" || role === "assistant") &&
      conversation.sessionMessageCount >= SESSION_MESSAGE_LIMIT
    ) {
      throw new AppError(
        "SESSION_LIMIT",
        "Esta sessão chegou a 30 mensagens. Encerre o atendimento para começar outra, ou fale com um analista.",
      );
    }
  }

  async function addMessage(
    conversationId: string,
    input: {
      role: StoredMessage["role"];
      authorName: string;
      text: string;
      decision?: DecisionTrace | null;
      payload?: unknown;
      now?: Date;
    },
  ) {
    const now = input.now ?? new Date();
    const conversation = await requireConversation(conversationId);
    await assertCanSend(conversation, input.role, now);
    const day = todayKey(now);
    const stored: StoredMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: input.role,
      authorName: input.authorName,
      text: input.text,
      createdAt: now.toISOString(),
      decision: input.decision ?? null,
      payload: input.payload ?? null,
    };
    await db.insert(messages).values({
      id: stored.id,
      conversationId,
      role: stored.role,
      authorName: stored.authorName,
      text: stored.text,
      createdAt: stored.createdAt,
      decisionJson: stored.decision ? JSON.stringify(stored.decision) : null,
      payloadJson: stored.payload ? JSON.stringify(stored.payload) : null,
    });
    const countsSession = stored.role === "user" || stored.role === "assistant";
    const countsDaily = stored.role === "user";
    await db
      .update(conversations)
      .set({
        updatedAt: stored.createdAt,
        sessionMessageCount: countsSession ? conversation.sessionMessageCount + 1 : conversation.sessionMessageCount,
        dailyDay: day,
        dailyCount: countsDaily ? (conversation.dailyDay === day ? conversation.dailyCount : 0) + 1 : conversation.dailyCount,
        summary: stored.role === "assistant" || stored.role === "user" ? stored.text.slice(0, 180) : conversation.summary,
      })
      .where(eq(conversations.id, conversationId));
    return stored;
  }

  async function listForAnalyst(analystId: string, filter: string, query: string) {
    const [conversationRows, userRows, messageRows] = await Promise.all([
      db.select().from(conversations),
      db.select().from(users),
      db.select().from(messages).orderBy(desc(messages.createdAt)),
    ]);
    const people = new Map(userRows.map((user) => [user.id, user]));
    const latest = new Map<string, (typeof messageRows)[number]>();
    for (const message of messageRows) {
      if (!latest.has(message.conversationId)) latest.set(message.conversationId, message);
    }
    const normalized = query.trim().toLowerCase();
    return conversationRows
      .filter((conversation) => {
        if (filter === "para_voce") return conversation.state === "aguardando_atendente";
        if (filter === "com_agent") return conversation.state === "com_agent";
        if (filter === "minhas") return conversation.state === "em_atendimento" && conversation.assigneeId === analystId;
        return true;
      })
      .map((conversation) => {
        const person = people.get(conversation.employeeId);
        const last = latest.get(conversation.id);
        return {
          id: conversation.id,
          employeeId: conversation.employeeId,
          employeeName: person?.name ?? "Funcionário",
          initials: person?.initials ?? "NX",
          department: person?.department ?? "",
          state: conversation.state as ConversationState,
          assigneeId: conversation.assigneeId,
          summary: conversation.summary,
          preview: last?.text ?? conversation.summary ?? "Sem mensagens",
          updatedAt: conversation.updatedAt,
          sessionMessageCount: conversation.sessionMessageCount,
        };
      })
      .filter((item) => {
        if (!normalized) return true;
        return `${item.employeeName} ${item.preview} ${item.summary ?? ""}`.toLowerCase().includes(normalized);
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async function assume(conversationId: string, analystId: string, analystName: string, now = new Date()) {
    const conversation = await requireConversation(conversationId);
    if (conversation.state === "em_atendimento" && conversation.assigneeId !== analystId) {
      throw new AppError("ALREADY_ASSIGNED", "Outro analista já assumiu esta conversa.");
    }
    if (conversation.state !== "aguardando_atendente" && conversation.assigneeId !== analystId) {
      throw new AppError("INVALID_STATE", "Só dá para assumir uma conversa que está aguardando atendente.");
    }
    await db
      .update(conversations)
      .set({
        state: "em_atendimento",
        assigneeId: analystId,
        updatedAt: now.toISOString(),
      })
      .where(eq(conversations.id, conversationId));
    return addMessage(conversationId, {
      role: "system",
      authorName: "Sistema",
      text: `${analystName} assumiu · agent pausado`,
      now,
    });
  }

  async function release(conversationId: string, analystId: string, now = new Date()) {
    const conversation = await requireConversation(conversationId);
    if (conversation.assigneeId !== analystId) {
      throw new AppError("FORBIDDEN", "Só quem assumiu a conversa pode devolvê-la ao agent.");
    }
    await db
      .update(conversations)
      .set({ state: "com_agent", assigneeId: null, updatedAt: now.toISOString() })
      .where(eq(conversations.id, conversationId));
    return addMessage(conversationId, {
      role: "system",
      authorName: "Sistema",
      text: "Conversa devolvida ao Nexo Assist",
      now,
    });
  }

  async function close(conversationId: string, analystId: string, now = new Date()) {
    const conversation = await requireConversation(conversationId);
    if (conversation.assigneeId !== analystId) {
      throw new AppError("FORBIDDEN", "Só quem assumiu a conversa pode encerrá-la.");
    }
    await db
      .update(conversations)
      .set({
        state: "encerrada",
        assigneeId: null,
        sessionMessageCount: 0,
        closedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(conversations.id, conversationId));
    return addMessage(conversationId, {
      role: "system",
      authorName: "Sistema",
      text: "Atendimento encerrado",
      now,
    });
  }

  async function markWaiting(conversationId: string, summary: string, now = new Date()) {
    await db
      .update(conversations)
      .set({
        state: "aguardando_atendente",
        assigneeId: null,
        summary,
        updatedAt: now.toISOString(),
      })
      .where(eq(conversations.id, conversationId));
  }

  return {
    getOrCreateForEmployee,
    listMessages,
    addMessage,
    listForAnalyst,
    assume,
    release,
    close,
    markWaiting,
    requireConversation,
  };
}
