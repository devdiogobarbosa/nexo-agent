import { describe, expect, it } from "vitest";
import { addBusinessDays, addBusinessHours, deadlineFor, isOverdue } from "@/server/sla/business-time";

function saoPaulo(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
}

describe("prazos do service desk", () => {
  it("trata prioridade crítica como uma hora corrida, inclusive de madrugada", () => {
    const start = saoPaulo(2026, 10, 23, 23, 30);
    expect(deadlineFor("critica", start).toISOString()).toBe(saoPaulo(2026, 10, 24, 0, 30).toISOString());
  });

  it("soma horas úteis atravessando a sexta-feira", () => {
    const friday = saoPaulo(2026, 10, 23, 16, 0);
    expect(addBusinessHours(friday, 4).toISOString()).toBe(saoPaulo(2026, 10, 26, 10, 0).toISOString());
  });

  it("soma horas úteis dentro do mesmo expediente", () => {
    const morning = saoPaulo(2026, 10, 27, 10, 0);
    expect(addBusinessHours(morning, 4).toISOString()).toBe(saoPaulo(2026, 10, 27, 14, 0).toISOString());
  });

  it("soma dias úteis sem contar o fim de semana", () => {
    const thursday = saoPaulo(2026, 10, 22, 14, 20);
    expect(addBusinessDays(thursday, 3).toISOString()).toBe(saoPaulo(2026, 10, 27, 14, 20).toISOString());
    expect(deadlineFor("baixa", thursday).toISOString()).toBe(
      saoPaulo(2026, 10, 29, 14, 20).toISOString(),
    );
  });

  it("começa a contar no próximo horário de expediente quando o pedido chega fechado", () => {
    const beforeOpen = saoPaulo(2026, 10, 27, 7, 15);
    expect(addBusinessHours(beforeOpen, 1).toISOString()).toBe(saoPaulo(2026, 10, 27, 9, 0).toISOString());
  });

  it("marca o chamado como vencido depois do prazo", () => {
    const due = saoPaulo(2026, 10, 21, 14, 20);
    expect(isOverdue(due, saoPaulo(2026, 10, 27, 10, 0))).toBe(true);
    expect(isOverdue(due, saoPaulo(2026, 10, 21, 14, 0))).toBe(false);
  });
});
