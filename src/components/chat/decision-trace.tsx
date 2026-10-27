import type { DecisionTrace } from "@/lib/domain";

export function DecisionTraceView({ decision }: { decision: DecisionTrace }) {
  return (
    <div className="mb-2">
      <div className="mb-2 flex flex-wrap gap-2">
        {decision.tools.map((tool) => (
          <span key={`${tool.id}-${tool.label}`} className="rounded-full bg-primary-soft px-2 py-1 text-xs text-primary-text">
            {tool.label}
          </span>
        ))}
      </div>
      <details className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">Como o Nexo decidiu</summary>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-ink-3">Entendimento</dt>
            <dd>{decision.understanding}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Ação</dt>
            <dd>{decision.action}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Confiança</dt>
            <dd>{Math.round(decision.confidence * 100)}%</dd>
          </div>
          <div>
            <dt className="text-ink-3">Por quê</dt>
            <dd>{decision.reason}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
