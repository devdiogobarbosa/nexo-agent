import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { DuplicateTicketError, ForbiddenTicketError, TicketUnavailableError } from "@/lib/errors";
import { openDatabase, type Database } from "@/server/db/client";
import { tickets, users } from "@/server/db/schema";
import { createTicketService, withTicketRetry } from "@/server/tickets/service";

const databases: Database[] = [];

async function scenario() {
  const db = await openDatabase(":memory:");
  databases.push(db);
  await db.insert(users).values([
    {
      id: "ana",
      name: "Ana Souza",
      email: "ana.souza@nexo.com.br",
      role: "funcionario",
      department: "Financeiro",
      initials: "AS",
      windowsVersion: "11",
      passwordChangedAt: null,
    },
    {
      id: "carla",
      name: "Carla Mendes",
      email: "carla.mendes@nexo.com.br",
      role: "funcionario",
      department: "Comercial",
      initials: "CM",
      windowsVersion: "11",
      passwordChangedAt: null,
    },
  ]);
  return createTicketService(db, { failureRate: 0, sleep: async () => undefined });
}

afterEach(() => {
  databases.length = 0;
});

describe("serviço de chamados", () => {
  it("não mostra chamado de outro funcionário", async () => {
    const service = await scenario();
    const created = await service.create({
      type: "INC",
      title: "Senha do SAP bloqueada",
      description: "Não consigo entrar no SAP.",
      category: "Acesso",
      priority: "media",
      requesterId: "ana",
      affectedScope: "somente_voce",
    });

    await expect(service.getForRequester("carla", created.id)).rejects.toBeInstanceOf(ForbiddenTicketError);
    await expect(service.listByRequester("carla")).resolves.toEqual([]);
  });

  it("recusa duplicar um chamado aberto do mesmo problema", async () => {
    const service = await scenario();
    const created = await service.create({
      type: "INC",
      title: "Notebook lento após atualização do Windows",
      description: "Lentidão geral.",
      category: "Hardware",
      priority: "media",
      requesterId: "ana",
      affectedScope: "somente_voce",
    });

    await expect(
      service.create({
        type: "INC",
        title: "Notebook continua lento depois da atualização",
        description: "O mesmo problema.",
        category: "Hardware",
        priority: "alta",
        requesterId: "ana",
        affectedScope: "somente_voce",
      }),
    ).rejects.toBeInstanceOf(DuplicateTicketError);

    const updated = await service.update("ana", created.id, { note: "A reunião foi mantida." });
    expect(updated.description).toContain("A reunião foi mantida.");
    expect(updated.id).toBe(created.id);
  });

  it("reabre chamado resolvido há menos de 7 dias e recusa o mais antigo", async () => {
    const service = await scenario();
    const db = databases[0];
    if (!db) throw new Error("banco de teste ausente");
    const now = new Date("2026-10-27T15:00:00.000Z");
    await db.insert(tickets).values([
      {
        id: "INC-20150",
        type: "INC",
        title: "Senha do SAP bloqueada",
        description: "Senha bloqueada depois de várias tentativas.",
        category: "Acesso",
        priority: "media",
        status: "resolvido",
        requesterId: "ana",
        affectedScope: "somente_voce",
        openedAt: "2026-10-20T15:00:00.000Z",
        updatedAt: "2026-10-23T15:00:00.000Z",
        resolvedAt: "2026-10-23T15:00:00.000Z",
        dueAt: "2026-10-23T15:00:00.000Z",
        assigneeId: null,
        lastEvent: "Resolvido",
      },
      {
        id: "INC-19410",
        type: "INC",
        title: "Troca de senha da rede",
        description: "Senha antiga expirou.",
        category: "Acesso",
        priority: "baixa",
        status: "resolvido",
        requesterId: "ana",
        affectedScope: "somente_voce",
        openedAt: "2026-07-11T15:00:00.000Z",
        updatedAt: "2026-07-11T18:00:00.000Z",
        resolvedAt: "2026-07-11T18:00:00.000Z",
        dueAt: "2026-07-16T18:00:00.000Z",
        assigneeId: null,
        lastEvent: "Resolvido",
      },
    ]);

    const reopened = await service.reopen("ana", "INC-20150", "A senha bloqueou de novo.", now);
    expect(reopened.status).toBe("aberto");
    expect(reopened.resolvedAt).toBeNull();
    await expect(service.reopen("ana", "INC-19410", "Quero reabrir.", now)).rejects.toThrow(/7 dias/);
  });

  it("tenta de novo quando o legado falha uma vez", async () => {
    const db = await openDatabase(":memory:");
    let draws = 0;
    const service = createTicketService(db, {
      failureRate: 1,
      random: () => (draws++ === 0 ? 0 : 1),
      sleep: async () => undefined,
    });

    await expect(service.listByRequester("ana")).rejects.toBeInstanceOf(TicketUnavailableError);
    draws = 0;
    await expect(withTicketRetry(() => service.listByRequester("ana"))).resolves.toEqual([]);
    const stored = await db.select().from(tickets).where(eq(tickets.requesterId, "ana"));
    expect(stored).toEqual([]);
  });
});
