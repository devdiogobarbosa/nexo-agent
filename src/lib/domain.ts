export const categories = [
  "Acesso",
  "Rede e VPN",
  "Hardware",
  "Software",
  "E-mail",
  "Outros",
] as const;

export const priorities = ["critica", "alta", "media", "baixa"] as const;

export const ticketTypes = ["INC", "REQ"] as const;

export const ticketStatuses = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "em_atendimento",
  "aprovado",
  "resolvido",
] as const;

export const conversationStates = [
  "com_agent",
  "aguardando_atendente",
  "em_atendimento",
  "encerrada",
] as const;

export const roles = ["funcionario", "analista"] as const;

export const affectedScopes = ["somente_voce", "equipe", "empresa", "desconhecido"] as const;

export const openTicketStatuses = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "em_atendimento",
  "aprovado",
] as const;

export type Category = (typeof categories)[number];
export type Priority = (typeof priorities)[number];
export type TicketType = (typeof ticketTypes)[number];
export type TicketStatus = (typeof ticketStatuses)[number];
export type ConversationState = (typeof conversationStates)[number];
export type Role = (typeof roles)[number];
export type AffectedScope = (typeof affectedScopes)[number];

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  initials: string;
  windowsVersion: string | null;
  passwordChangedAt: string | null;
};

export type Article = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  windowsVersion: string | null;
};

export type Ticket = {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  requesterId: string;
  affectedScope: AffectedScope;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  dueAt: string;
  assigneeId: string | null;
  lastEvent: string;
};

export type DecisionTrace = {
  understanding: string;
  action: string;
  confidence: number;
  reason: string;
  tools: Array<{ id: string; label: string }>;
};

export type ChatCard =
  | {
      kind: "draft";
      draftId: string;
      title: string;
      description: string;
      category: Category;
      priority: Priority;
      affectedScope: AffectedScope;
      dueLabel: string;
      type: TicketType;
      existingTicketId: string | null;
    }
  | {
      kind: "ticket";
      ticket: Ticket;
      overdue: boolean;
    }
  | {
      kind: "selector";
      tickets: Ticket[];
    }
  | {
      kind: "options";
      options: Array<{ id: string; label: string }>;
    };

export const priorityLabels: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const statusLabels: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  em_atendimento: "Em atendimento",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
};

export const affectedLabels: Record<AffectedScope, string> = {
  somente_voce: "Somente você",
  equipe: "Minha equipe",
  empresa: "Toda a empresa",
  desconhecido: "Não informado",
};

export const SESSION_MESSAGE_LIMIT = 30;

export const SLA_RULES: Record<
  Priority,
  { label: string; amount: number; unit: "clock_hours" | "business_hours" | "business_days" }
> = {
  critica: { label: "1 hora", amount: 1, unit: "clock_hours" },
  alta: { label: "4 horas úteis", amount: 4, unit: "business_hours" },
  media: { label: "3 dias úteis", amount: 3, unit: "business_days" },
  baixa: { label: "5 dias úteis", amount: 5, unit: "business_days" },
};
