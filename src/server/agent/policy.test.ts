import { describe, expect, it } from "vitest";
import { wantsAnalyst } from "@/server/agent/policy";

describe("pedido de analista", () => {
  it("reconhece o pedido explícito e o botão, e ignora a recusa", () => {
    expect(wantsAnalyst("Quero falar com um analista.")).toBe(true);
    expect(wantsAnalyst("pode ser", "transfer")).toBe(true);
    expect(wantsAnalyst("Não quero um analista.")).toBe(false);
    expect(wantsAnalyst("Qual o status do meu chamado?")).toBe(false);
  });
});
