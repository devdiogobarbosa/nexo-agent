import { describe, expect, it } from "vitest";
import { splitDecision, withTools } from "@/server/agent/trace";

describe("rastro da decisão", () => {
  it("esconde o bloco técnico e guarda entendimento, ação, confiança e motivo", () => {
    const raw = `Vou abrir um chamado.
<decisao>{"understanding":"VPN no Windows 11","action":"Preparar rascunho","confidence":0.82,"reason":"O artigo não cobre esse Windows."}</decisao>`;
    const { visible, decision } = splitDecision(raw);
    expect(visible).toBe("Vou abrir um chamado.");
    expect(decision?.confidence).toBe(0.82);
    expect(decision?.action).toBe("Preparar rascunho");
  });

  it("reconstrói o rastro quando o modelo não fecha o bloco", () => {
    const trace = withTools(null, [{ id: "listarMeusChamados", label: "consultou seus chamados" }], "Consulta de status");
    expect(trace.tools).toHaveLength(1);
    expect(trace.reason).toContain("ferramentas");
  });
});
