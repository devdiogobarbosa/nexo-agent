import type { DecisionTrace } from "@/lib/domain";

const TOOL_LABELS: Record<string, string> = {
  buscarCentralDeAjuda: "buscou na central de ajuda",
  listarMeusChamados: "consultou seus chamados",
  consultarChamado: "consultou o chamado",
  calcularPrazo: "consultou o SLA",
  prepararRascunho: "montou o rascunho",
  proporTransferencia: "sugeriu transferência",
};

export function labelForTool(toolName: string, detail?: string) {
  if (toolName === "consultarChamado" && detail) return `consultou o ${detail}`;
  if (toolName === "prepararRascunho") return "classificou a prioridade";
  if (toolName === "calcularPrazo") return "calculou o prazo";
  return TOOL_LABELS[toolName] ?? toolName;
}

export function splitDecision(text: string): { visible: string; decision: DecisionTrace | null } {
  const match = text.match(/<decisao>([\s\S]*?)<\/decisao>/);
  const visible = text.replace(/<decisao>[\s\S]*?<\/decisao>/g, "").trim();
  if (!match?.[1]) return { visible, decision: null };
  try {
    const parsed = JSON.parse(match[1]) as Partial<DecisionTrace>;
    if (typeof parsed.understanding !== "string" || typeof parsed.action !== "string" || typeof parsed.reason !== "string") {
      return { visible, decision: null };
    }
    const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
    return {
      visible,
      decision: {
        understanding: parsed.understanding,
        action: parsed.action,
        confidence,
        reason: parsed.reason,
        tools: [],
      },
    };
  } catch {
    return { visible, decision: null };
  }
}

export function withTools(decision: DecisionTrace | null, tools: Array<{ id: string; label: string }>, fallback: string): DecisionTrace {
  if (decision) return { ...decision, tools };
  return {
    understanding: fallback,
    action: tools.at(-1)?.label ?? "Responder no chat",
    confidence: 0.5,
    reason: "O rastro foi montado a partir das ferramentas executadas.",
    tools,
  };
}
