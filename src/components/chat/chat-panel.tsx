"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DecisionTraceView } from "@/components/chat/decision-trace";
import { SESSION_MESSAGE_LIMIT, priorityLabels, statusLabels, type Ticket } from "@/lib/domain";
import { formatClock } from "@/lib/format";
import type { StoredMessage } from "@/server/conversations/service";

export function ChatPanel({
  messages,
  sessionCount,
  paused,
  tickets,
}: {
  messages: StoredMessage[];
  sessionCount: number;
  paused: boolean;
  tickets: Array<Ticket & { overdue: boolean }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Não foi possível enviar.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-rule bg-paper px-4 py-4 md:px-8">
        <div>
          <p className="text-sm text-ink-3">Service desk de TI</p>
          <h1 className="text-lg font-medium">Atendimento</h1>
        </div>
        <p className="text-sm text-success-text">{paused ? "Agent pausado" : "Assistente online"}</p>
      </header>
      <div className="flex-1 space-y-4 px-4 py-6 md:px-8">
        {messages.length === 0 ? (
          <p className="text-ink-2">Descreva o que está acontecendo. O Nexo consulta seus chamados e a central de ajuda.</p>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "ml-auto max-w-2xl" : "max-w-2xl"}>
            {message.role === "assistant" && message.decision ? <DecisionTraceView decision={message.decision} /> : null}
            <div
              className={
                message.role === "user"
                  ? "rounded-lg bg-ink px-4 py-3 text-white"
                  : message.role === "system"
                    ? "text-center text-sm text-ink-3"
                    : "rounded-lg border border-rule bg-paper px-4 py-3"
              }
            >
              {message.role !== "system" ? (
                <p className="mb-1 text-xs opacity-70">
                  {message.authorName} · {formatClock(message.createdAt)}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          </article>
        ))}
        {tickets.length > 0 ? (
          <aside className="rounded-lg border border-rule bg-paper p-4">
            <h2 className="font-medium">Seus chamados</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {tickets.slice(0, 5).map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-data text-ink-3">{ticket.id}</span> {ticket.title}
                  </span>
                  <span className={ticket.overdue ? "text-danger-text" : "text-ink-3"}>
                    {statusLabels[ticket.status]} · {priorityLabels[ticket.priority]}
                    {ticket.overdue ? " · prazo vencido" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
      <form onSubmit={send} className="border-t border-rule bg-paper px-4 py-4 md:px-8">
        {paused ? <p className="mb-2 text-sm text-warning-text">Um analista está com esta conversa. O agent não responde até ser liberado.</p> : null}
        {error ? <p className="mb-2 text-sm text-danger-text">{error}</p> : null}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={paused ? "Escreva para o analista…" : "Escreva para o Nexo…"}
            className="flex-1 rounded-md border border-rule px-3 py-3 outline-none focus:border-cta"
          />
          <button type="submit" disabled={sending} className="rounded-md bg-cta px-4 py-3 text-white disabled:opacity-60">
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {sessionCount}/{SESSION_MESSAGE_LIMIT} mensagens nesta sessão
        </p>
      </form>
    </section>
  );
}
