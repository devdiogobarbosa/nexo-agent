"use client";

export default function AtendimentoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <p className="text-danger-text">Não foi possível abrir o atendimento.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-ink px-4 py-2 text-white">
        Tentar de novo
      </button>
    </div>
  );
}
