"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DecisionTraceView } from "@/components/chat/decision-trace";
import {
  SESSION_MESSAGE_LIMIT,
  affectedLabels,
  priorityLabels,
  statusLabels,
  type ChatCard,
  type Ticket,
} from "@/lib/domain";
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
  const [liveText, setLiveText] = useState("");

  async function sendText(value: string, action?: string) {
    if (!value.trim()) return;
    setSending(true);
    setError(null);
    setLiveText("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value, action }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const body = (await response.json()) as { error?: string };
        if (!response.ok) setError(body.error ?? "Não foi possível enviar.");
        setText("");
        router.refresh();
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (reader) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split("\n").find((item) => item.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as { type: string; delta?: string; message?: string };
          if (payload.type === "text" && payload.delta) setLiveText((current) => current + payload.delta);
          if (payload.type === "error" && payload.message) setError(payload.message);
        }
      }
      setText("");
      setLiveText("");
      router.refresh();
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setSending(false);
    }
  }

  function cardsOf(payload: unknown): ChatCard[] {
  if (!payload || typeof payload !== "object" || !("cards" in payload)) return [];
  const cards = (payload as { cards?: unknown }).cards;
  return Array.isArray(cards) ? (cards as ChatCard[]) : [];
}

function MessageCards({
  payload,
  onChoose,
  onDraft,
}: {
  payload: unknown;
  onChoose: (label: string, action?: string) => void;
  onDraft: (draftId: string, action: "confirmar" | "cancelar") => Promise<void>;
}) {
  const cards = cardsOf(payload);
  if (cards.length === 0) return null;
  return (
    <div className="mt-3 space-y-3">
      {cards.map((card, index) => {
        if (card.kind === "draft") {
          return (
            <div key={card.draftId} className="rounded-md border border-rule bg-desk p-3 text-sm">
              <p className="text-xs text-ink-3">Rascunho · aguardando confirmação</p>
              <p className="mt-1 font-medium">{card.title}</p>
              <p className="mt-1 text-ink-2">{card.description}</p>
              <p className="mt-2 text-ink-3">
                {card.category} · {priorityLabels[card.priority]} · {affectedLabels[card.affectedScope]} · {card.dueLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-md bg-cta px-3 py-2 text-white" onClick={() => void onDraft(card.draftId, "confirmar")}>
                  Confirmar
                </button>
                <button type="button" className="rounded-md border border-rule px-3 py-2" onClick={() => void onDraft(card.draftId, "cancelar")}>
                  Cancelar
                </button>
              </div>
            </div>
          );
        }
        if (card.kind === "selector") {
          return (
            <div key={`selector-${index}`} className="space-y-2">
              {card.tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="block w-full rounded-md border border-rule px-3 py-2 text-left text-sm"
                  onClick={() => onChoose(`${ticket.id} · ${ticket.title}`)}
                >
                  <span className="font-data text-xs text-ink-3">{ticket.id}</span>
                  <span className="mt-1 block">{ticket.title}</span>
                </button>
              ))}
            </div>
          );
        }
        if (card.kind === "options") {
          return (
            <div key={`options-${index}`} className="flex flex-wrap gap-2">
              {card.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="rounded-full border border-rule px-3 py-2 text-sm"
                  onClick={() => onChoose(option.label, option.id === "transfer" ? "transfer" : undefined)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          );
        }
        return (
          <div key={card.ticket.id} className="rounded-md border border-rule bg-desk p-3 text-sm">
            <p className="font-data text-xs text-ink-3">{card.ticket.id}</p>
            <p className="font-medium">{card.ticket.title}</p>
            <p className={card.overdue ? "text-danger-text" : "text-ink-3"}>
              {statusLabels[card.ticket.status]} · {priorityLabels[card.ticket.priority]}
              {card.overdue ? " · prazo vencido" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendText(text);
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
              <MessageCards
                payload={message.payload}
                onChoose={(label, action) => void sendText(label, action)}
                onDraft={async (draftId, action) => {
                  setSending(true);
                  setError(null);
                  try {
                    const response = await fetch(`/api/drafts/${draftId}`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ action }),
                    });
                    const body = (await response.json()) as { error?: string };
                    if (!response.ok) setError(body.error ?? "Não foi possível confirmar o rascunho.");
                    router.refresh();
                  } catch {
                    setError("Não foi possível falar com o servidor.");
                  } finally {
                    setSending(false);
                  }
                }}
              />
            </div>
          </article>
        ))}
        {liveText ? (
          <article className="max-w-2xl rounded-lg border border-rule bg-paper px-4 py-3">
            <p className="mb-1 text-xs text-ink-3">Nexo Assist</p>
            <p className="whitespace-pre-wrap">{liveText}</p>
          </article>
        ) : null}
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
