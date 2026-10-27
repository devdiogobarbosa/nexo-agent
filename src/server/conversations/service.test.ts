import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { openDatabase } from "@/server/db/client";
import { createConversationService } from "@/server/conversations/service";

describe("estado da conversa", () => {
  it("pausa o agent ao transferir, impede dois analistas e devolve o atendimento", async () => {
    const db = await openDatabase(":memory:");
    const service = createConversationService(db);
    const conversation = await service.getOrCreateForEmployee("ana");
    await service.markWaiting(conversation.id, "Ana pediu um analista.");

    await service.assume(conversation.id, "rafael", "Rafael Lima");
    await expect(service.assume(conversation.id, "outro", "Outro Analista")).rejects.toBeInstanceOf(AppError);

    const waiting = await service.requireConversation(conversation.id);
    expect(waiting.state).toBe("em_atendimento");
    expect(waiting.assigneeId).toBe("rafael");

    await service.release(conversation.id, "rafael");
    const released = await service.requireConversation(conversation.id);
    expect(released.state).toBe("com_agent");
    expect(released.assigneeId).toBeNull();
  });

  it("zera a sessão de 30 mensagens quando o analista encerra", async () => {
    const db = await openDatabase(":memory:");
    const service = createConversationService(db);
    const conversation = await service.getOrCreateForEmployee("ana");
    await service.addMessage(conversation.id, { role: "user", authorName: "Ana Souza", text: "Oi" });
    await service.markWaiting(conversation.id, "resumo");
    await service.assume(conversation.id, "rafael", "Rafael Lima");
    await service.close(conversation.id, "rafael");

    const next = await service.getOrCreateForEmployee("ana");
    expect(next.id).toBe(conversation.id);
    expect(next.state).toBe("com_agent");
    expect(next.sessionMessageCount).toBe(0);
  });

  it("bloqueia a 31ª mensagem da sessão com o agent", async () => {
    const db = await openDatabase(":memory:");
    const service = createConversationService(db);
    const conversation = await service.getOrCreateForEmployee("ana");
    for (let index = 0; index < 30; index += 1) {
      await service.addMessage(conversation.id, {
        role: index % 2 === 0 ? "user" : "assistant",
        authorName: index % 2 === 0 ? "Ana Souza" : "Nexo Assist",
        text: `mensagem ${index}`,
      });
    }
    await expect(
      service.addMessage(conversation.id, { role: "user", authorName: "Ana Souza", text: "mais uma" }),
    ).rejects.toMatchObject({ code: "SESSION_LIMIT" });
  });
});
