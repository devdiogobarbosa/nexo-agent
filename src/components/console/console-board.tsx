"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DecisionTraceView } from "@/components/chat/decision-trace";
import { LogoutButton } from "@/components/layout/logout-button";
import { priorityLabels, statusLabels, type Ticket, type User } from "@/lib/domain";
import { conversationStateLabels, formatClock } from "@/lib/format";
import type { StoredMessage } from "@/server/conversations/service";

export type ConsoleListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  initials: string;
  department: string;
  state: keyof typeof conversationStateLabels;
  assigneeId: string | null;
  preview: string;
  updatedAt: string;
};

const filters = [
  { id: "todas", label: "Todas" },
  { id: "para_voce", label: "Para você" },
  { id: "com_agent", label: "Com o agent" },
  { id: "minhas", label: "Minhas" },
] as const;

export function ConsoleBoard({
  analystName,
  items,
  filter,
  query,
  selected,
}: {
  analystName: string;
  items: ConsoleListItem[];
  filter: string;
  query: string;
  selected: {
    conversationId: string;
    state: keyof typeof conversationStateLabels;
    assigneeId: string | null;
    analystId: string;
    employee: User | null;
    messages: StoredMessage[];
    tickets: Array<Ticket & { overdue: boolean }>;
  } | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showTickets, setShowTickets] = useState(false);

  function href(next: { filtro?: string; q?: string; conversa?: string }) {
    const params = new URLSearchParams();
    params.set("filtro", next.filtro ?? filter);
    if ((next.q ?? query).trim()) params.set("q", next.q ?? query);
    if (next.conversa) params.set("conversa", next.conversa);
    return `/console?${params.toString()}`;
  }

  async function act(action: "assumir" | "devolver" | "encerrar" | "mensagem", message?: string) {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/console/conversations/${selected.conversationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, text: message }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Não foi possível concluir.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setPending(false);
    }
  }

  const mine = selected?.assigneeId === selected?.analystId && selected?.state === "em_atendimento";
  const waiting = selected?.state === "aguardando_atendente";

  return (
    <div className="min-h-screen bg-desk lg:grid lg:grid-cols-[280px_minmax(0,1fr)_300px]">
      <aside className="border-b border-rule bg-paper lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-display text-2xl">Conversas</h1>
            <p className="text-sm text-success-text">Disponível · {analystName}</p>
          </div>
          <LogoutButton />
        </div>
        <form action="/console" className="px-4">
          <input type="hidden" name="filtro" value={filter} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Pesquisar conversa ou chamado"
            className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:border-cta"
          />
        </form>
        <div className="flex gap-2 overflow-x-auto px-4 py-3 text-sm">
          {filters.map((item) => (
            <Link
              key={item.id}
              href={href({ filtro: item.id, conversa: selected?.conversationId })}
              className={filter === item.id ? "rounded-full bg-ink px-3 py-1 text-white" : "rounded-full bg-card px-3 py-1 text-ink-2"}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <ul className="max-h-80 overflow-auto lg:max-h-none">
          {items.length === 0 ? <li className="px-4 py-6 text-sm text-ink-3">Nenhuma conversa neste filtro.</li> : null}
          {items.map((item) => (
            <li key={item.id}>
              <Link href={href({ conversa: item.id })} className="block border-t border-rule px-4 py-3 hover:bg-desk">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{item.employeeName}</span>
                  <span className="text-xs text-ink-3">{formatClock(item.updatedAt)}</span>
                </span>
                <span className="mt-1 block truncate text-sm text-ink-2">{item.preview}</span>
                <span className="mt-2 inline-block rounded-full bg-violet-soft px-2 py-1 text-xs text-violet-text">
                  {item.state === "em_atendimento" && item.assigneeId === selected?.analystId
                    ? "Você está atendendo"
                    : conversationStateLabels[item.state]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-h-[70vh] flex-col">
        {selected ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-paper px-4 py-4">
              <div>
                <h2 className="text-lg font-medium">{selected.employee?.name}</h2>
                <p className="text-sm text-ink-3">
                  {selected.employee?.department} · {conversationStateLabels[selected.state]}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="text-sm text-primary-text lg:hidden" onClick={() => setShowTickets((value) => !value)}>
                  Chamados
                </button>
                {waiting ? (
                  <button type="button" disabled={pending} onClick={() => act("assumir")} className="rounded-md bg-cta px-3 py-2 text-sm text-white">
                    Assumir atendimento
                  </button>
                ) : null}
                {mine ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => act("devolver")} className="rounded-md border border-rule px-3 py-2 text-sm">
                      Devolver ao agent
                    </button>
                    <button type="button" disabled={pending} onClick={() => act("encerrar")} className="rounded-md border border-rule px-3 py-2 text-sm">
                      Encerrar atendimento
                    </button>
                  </>
                ) : null}
              </div>
            </header>
            <div className="flex-1 space-y-4 px-4 py-5">
              {selected.messages.map((message) => (
                <article key={message.id} className={message.role === "user" ? "ml-auto max-w-xl" : "max-w-xl"}>
                  {message.decision ? <DecisionTraceView decision={message.decision} /> : null}
                  <div className={message.role === "system" ? "text-center text-sm text-ink-3" : "rounded-lg border border-rule bg-paper px-4 py-3"}>
                    {message.role !== "system" ? (
                      <p className="mb-1 text-xs text-ink-3">
                        {message.authorName} · {formatClock(message.createdAt)}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </article>
              ))}
            </div>
            <form
              className="border-t border-rule bg-paper px-4 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void act("mensagem", text);
              }}
            >
              {error ? <p className="mb-2 text-sm text-danger-text">{error}</p> : null}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={!mine}
                  placeholder={mine ? "Escreva para o funcionário…" : "Assuma o atendimento para responder"}
                  className="flex-1 rounded-md border border-rule px-3 py-3 outline-none focus:border-cta disabled:bg-card"
                />
                <button type="submit" disabled={!mine || pending} className="rounded-md bg-ink px-4 py-3 text-white disabled:opacity-40">
                  Enviar
                </button>
              </div>
            </form>
          </>
        ) : (
          <p className="p-8 text-ink-2">Selecione uma conversa da fila.</p>
        )}
      </section>
      <aside className={`${showTickets ? "block" : "hidden"} border-t border-rule bg-paper p-4 lg:block lg:border-t-0 lg:border-l`}>
        <h2 className="font-medium">Chamados {selected?.employee ? `de ${selected.employee.name.split(" ")[0]}` : ""}</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {selected?.tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-md border border-rule p-3">
              <p className="font-data text-xs text-ink-3">{ticket.id}</p>
              <p className="font-medium">{ticket.title}</p>
              <p className={ticket.overdue ? "text-danger-text" : "text-ink-3"}>
                {statusLabels[ticket.status]} · {priorityLabels[ticket.priority]}
                {ticket.overdue ? " · prazo vencido" : ""}
              </p>
            </li>
          ))}
          {selected && selected.tickets.length === 0 ? <li className="text-ink-3">Nenhum chamado.</li> : null}
        </ul>
      </aside>
    </div>
  );
}
