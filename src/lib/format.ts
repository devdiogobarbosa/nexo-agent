import type { ConversationState } from "@/lib/domain";

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const conversationStateLabels: Record<ConversationState, string> = {
  com_agent: "Agent atendendo",
  aguardando_atendente: "Aguardando atendente",
  em_atendimento: "Você está atendendo",
  encerrada: "Resolvida pelo agent",
};
