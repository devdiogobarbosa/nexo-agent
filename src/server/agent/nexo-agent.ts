import { Agent } from "@mastra/core/agent";
import { NEXO_INSTRUCTIONS } from "@/server/agent/instructions";
import { nexoTools } from "@/server/agent/tools";

export function nexoModel() {
  return process.env.LLM_MODEL?.trim() || "openai/gpt-6.1-sol";
}

export function nexoAgent() {
  return new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: NEXO_INSTRUCTIONS,
    model: nexoModel(),
    tools: nexoTools,
  });
}

export function modelConfigured() {
  const model = nexoModel();
  if (model.startsWith("openai/")) return Boolean(process.env.OPENAI_API_KEY);
  if (model.startsWith("anthropic/")) return Boolean(process.env.ANTHROPIC_API_KEY);
  if (model.startsWith("google/")) return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  return Boolean(process.env.LLM_API_KEY);
}
