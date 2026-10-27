import { openDatabase } from "@/server/db/client";
import { articles, conversations, messages, tickets, users } from "@/server/db/schema";
import { deadlineFor } from "@/server/sla/business-time";
import { wallClock } from "@/server/sla/business-time";

function daysAgo(days: number, hour: number, minute = 0) {
  const clock = wallClock(new Date());
  return new Date(Date.UTC(clock.year, clock.month - 1, clock.day - days, hour + 3, minute, 0));
}

async function main() {
  const db = await openDatabase();
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(tickets);
  await db.delete(articles);
  await db.delete(users);

  const passwordChangedAt = daysAgo(42, 9).toISOString();
  const people: Array<{
    id: string;
    name: string;
    email: string;
    role: "funcionario" | "analista";
    department: string;
    initials: string;
    windowsVersion: string | null;
  }> = [
    { id: "ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "funcionario", department: "Financeiro", initials: "AS", windowsVersion: "11" },
    { id: "carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "funcionario", department: "Comercial", initials: "CM", windowsVersion: "11" },
    { id: "bruno", name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", role: "funcionario", department: "Operações", initials: "BT", windowsVersion: "10" },
    { id: "diego", name: "Diego Ramos", email: "diego.ramos@nexo.com.br", role: "funcionario", department: "Engenharia", initials: "DR", windowsVersion: "11" },
    { id: "elisa", name: "Elisa Prado", email: "elisa.prado@nexo.com.br", role: "funcionario", department: "RH", initials: "EP", windowsVersion: "11" },
    { id: "fabio", name: "Fábio Nunes", email: "fabio.nunes@nexo.com.br", role: "funcionario", department: "Marketing", initials: "FN", windowsVersion: "10" },
    { id: "gabriela", name: "Gabriela Rocha", email: "gabriela.rocha@nexo.com.br", role: "funcionario", department: "Jurídico", initials: "GR", windowsVersion: "11" },
    { id: "rafael", name: "Rafael Lima", email: "rafael.lima@nexo.com.br", role: "analista", department: "Suporte N2", initials: "RL", windowsVersion: null },
  ];
  await db.insert(users).values(
    people.map((person) => ({
      ...person,
      passwordChangedAt: person.role === "funcionario" ? passwordChangedAt : null,
    })),
  );

  await db.insert(articles).values([
    {
      id: "art-vpn-809",
      title: "VPN com erro 809",
      body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
      tags: "vpn,erro,809,rede",
      windowsVersion: "10",
    },
    {
      id: "art-horario",
      title: "Horário do service desk",
      body: "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
      tags: "horario,expediente,plantao",
      windowsVersion: null,
    },
    {
      id: "art-sap",
      title: "Senha do SAP bloqueada",
      body: "Depois de cinco tentativas a senha do SAP bloqueia. Aguarde 15 minutos e tente de novo. Se continuar bloqueada, abra um chamado de acesso.",
      tags: "sap,senha,acesso",
      windowsVersion: null,
    },
    {
      id: "art-notebook",
      title: "Notebook lento depois do Windows",
      body: "Reinicie o notebook e rode o diagnóstico de desempenho da central de software. Se a lentidão continuar depois da atualização, abra um chamado de hardware.",
      tags: "notebook,lento,windows,hardware",
      windowsVersion: null,
    },
    {
      id: "art-outlook",
      title: "Outlook não sincroniza no celular",
      body: "Remova a conta e adicione de novo pelo aplicativo oficial da empresa. Confira se o dispositivo está registrado no portal de acessos.",
      tags: "outlook,email,celular",
      windowsVersion: null,
    },
    {
      id: "art-monitor",
      title: "Segundo monitor para home office",
      body: "O pedido de segundo monitor é uma requisição de hardware. Informe se o notebook tem HDMI ou USB-C. A aprovação não entrega o equipamento no mesmo dia.",
      tags: "monitor,home office,hardware",
      windowsVersion: null,
    },
    {
      id: "art-wifi",
      title: "Senha do Wi-Fi corporativo",
      body: "A senha do Wi-Fi da sede muda toda sexta. Consulte o portal interno na rede cabeada ou peça a um colega já conectado. Não envie a senha por e-mail pessoal.",
      tags: "wifi,senha,rede",
      windowsVersion: null,
    },
    {
      id: "art-sharepoint",
      title: "Acesso a pasta no SharePoint",
      body: "Acesso a pasta de outra área é uma requisição. Informe o endereço da pasta e a aprovação do gestor. O agent não libera o acesso sozinho.",
      tags: "sharepoint,acesso,pasta",
      windowsVersion: null,
    },
  ]);

  const notebookOpened = daysAgo(8, 14, 20);
  const notebookDue = deadlineFor("media", notebookOpened);
  const sharepointOpened = daysAgo(13, 11, 5);
  const monitorOpened = daysAgo(18, 9, 40);
  const sapResolved = daysAgo(4, 16, 10);
  const carlaOpened = daysAgo(0, 9, 40);

  await db.insert(tickets).values([
    {
      id: "INC-20311",
      type: "INC",
      title: "Notebook lento após atualização do Windows",
      description: "Lentidão geral desde a atualização. Reiniciar e rodar o diagnóstico da central não resolveu.",
      category: "Hardware",
      priority: "media",
      status: "aguardando_analista",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: notebookOpened.toISOString(),
      updatedAt: notebookOpened.toISOString(),
      resolvedAt: null,
      dueAt: notebookDue.toISOString(),
      assigneeId: null,
      lastEvent: "Aguardando analista",
    },
    {
      id: "INC-20298",
      type: "INC",
      title: "Acesso à pasta Financeiro no SharePoint",
      description: "Ana precisa consultar a pasta Financeiro para fechar o relatório. O gestor já aprovou.",
      category: "Acesso",
      priority: "media",
      status: "em_andamento",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: sharepointOpened.toISOString(),
      updatedAt: daysAgo(2, 15).toISOString(),
      resolvedAt: null,
      dueAt: deadlineFor("media", daysAgo(1, 10)).toISOString(),
      assigneeId: "rafael",
      lastEvent: "Em andamento com o Suporte N2",
    },
    {
      id: "REQ-10442",
      type: "REQ",
      title: "Segundo monitor para home office",
      description: "Pedido de segundo monitor. O notebook tem saída HDMI.",
      category: "Hardware",
      priority: "baixa",
      status: "aprovado",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: monitorOpened.toISOString(),
      updatedAt: daysAgo(7, 11).toISOString(),
      resolvedAt: null,
      dueAt: deadlineFor("baixa", new Date()).toISOString(),
      assigneeId: null,
      lastEvent: "Aprovado, aguardando entrega",
    },
    {
      id: "INC-20150",
      type: "INC",
      title: "Senha do SAP bloqueada",
      description: "A senha bloqueou depois de várias tentativas e voltou a funcionar no mesmo dia.",
      category: "Acesso",
      priority: "media",
      status: "resolvido",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: daysAgo(6, 9).toISOString(),
      updatedAt: sapResolved.toISOString(),
      resolvedAt: sapResolved.toISOString(),
      dueAt: sapResolved.toISOString(),
      assigneeId: null,
      lastEvent: "Resolvido",
    },
    {
      id: "INC-19877",
      type: "INC",
      title: "Outlook não sincroniza no celular",
      description: "A conta foi recriada no aplicativo oficial.",
      category: "E-mail",
      priority: "baixa",
      status: "resolvido",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: "2026-09-01T14:00:00.000Z",
      updatedAt: "2026-09-02T18:00:00.000Z",
      resolvedAt: "2026-09-02T18:00:00.000Z",
      dueAt: "2026-09-08T18:00:00.000Z",
      assigneeId: null,
      lastEvent: "Resolvido em 02 set",
    },
    {
      id: "INC-19410",
      type: "INC",
      title: "Troca de senha da rede",
      description: "Senha da rede redefinida no balcão.",
      category: "Acesso",
      priority: "baixa",
      status: "resolvido",
      requesterId: "ana",
      affectedScope: "somente_voce",
      openedAt: "2026-07-11T12:00:00.000Z",
      updatedAt: "2026-07-11T16:00:00.000Z",
      resolvedAt: "2026-07-11T16:00:00.000Z",
      dueAt: "2026-07-18T16:00:00.000Z",
      assigneeId: null,
      lastEvent: "Resolvido em 11 jul",
    },
    {
      id: "INC-20518",
      type: "INC",
      title: "Acesso ao SAP ainda hoje",
      description: "Carla não consegue lançar pedidos. Há compromisso no mesmo dia.",
      category: "Acesso",
      priority: "alta",
      status: "aguardando_analista",
      requesterId: "carla",
      affectedScope: "somente_voce",
      openedAt: carlaOpened.toISOString(),
      updatedAt: carlaOpened.toISOString(),
      resolvedAt: null,
      dueAt: deadlineFor("alta", carlaOpened).toISOString(),
      assigneeId: null,
      lastEvent: "Transferido para um analista",
    },
  ]);

  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await db.insert(conversations).values([
    {
      id: "conv-carla",
      employeeId: "carla",
      state: "aguardando_atendente",
      assigneeId: null,
      sessionMessageCount: 4,
      dailyCount: 4,
      dailyDay: day,
      summary: "Carla precisa de acesso ao SAP ainda hoje. O agent transferiu por compromisso no mesmo dia.",
      updatedAt: carlaOpened.toISOString(),
      closedAt: null,
    },
    {
      id: "conv-bruno",
      employeeId: "bruno",
      state: "aguardando_atendente",
      assigneeId: null,
      sessionMessageCount: 6,
      dailyCount: 6,
      dailyDay: day,
      summary: "Bruno descreveu uma falha incomum no cliente de VPN do Windows 10. O agent não teve segurança para decidir.",
      updatedAt: daysAgo(0, 9, 51).toISOString(),
      closedAt: null,
    },
    {
      id: "conv-diego",
      employeeId: "diego",
      state: "com_agent",
      assigneeId: null,
      sessionMessageCount: 2,
      dailyCount: 2,
      dailyDay: day,
      summary: null,
      updatedAt: now,
      closedAt: null,
    },
    {
      id: "conv-fabio",
      employeeId: "fabio",
      state: "encerrada",
      assigneeId: null,
      sessionMessageCount: 0,
      dailyCount: 3,
      dailyDay: day,
      summary: "A senha do Wi-Fi foi orientada pela central de ajuda.",
      updatedAt: daysAgo(0, 10, 1).toISOString(),
      closedAt: daysAgo(0, 10, 1).toISOString(),
    },
  ]);

  await db.insert(messages).values([
    {
      id: "msg-carla-1",
      conversationId: "conv-carla",
      role: "user",
      authorName: "Carla Mendes",
      text: "Preciso de acesso ao SAP ainda hoje.",
      createdAt: carlaOpened.toISOString(),
      decisionJson: null,
      payloadJson: null,
    },
    {
      id: "msg-carla-2",
      conversationId: "conv-carla",
      role: "assistant",
      authorName: "Nexo Assist",
      text: "Isso impede o seu trabalho hoje. Vou chamar um analista.",
      createdAt: carlaOpened.toISOString(),
      decisionJson: JSON.stringify({
        understanding: "Pedido de acesso ao SAP com compromisso no mesmo dia.",
        action: "Transferir para o analista",
        confidence: 0.86,
        reason: "Prioridade alta: a pessoa não consegue trabalhar e há compromisso hoje.",
        tools: [{ id: "proporTransferencia", label: "sugeriu transferência" }],
      }),
      payloadJson: null,
    },
    {
      id: "msg-bruno-1",
      conversationId: "conv-bruno",
      role: "assistant",
      authorName: "Nexo Assist",
      text: "Vou chamar um analista para isso.",
      createdAt: daysAgo(0, 9, 51).toISOString(),
      decisionJson: JSON.stringify({
        understanding: "Falha de VPN fora do artigo conhecido.",
        action: "Pedir ajuda de um analista",
        confidence: 0.41,
        reason: "A central de ajuda não cobre o sintoma e a confiança ficou baixa.",
        tools: [{ id: "buscarCentralDeAjuda", label: "buscou na central de ajuda" }],
      }),
      payloadJson: null,
    },
    {
      id: "msg-fabio-1",
      conversationId: "conv-fabio",
      role: "user",
      authorName: "Fábio Nunes",
      text: "Isso resolveu, obrigado!",
      createdAt: daysAgo(0, 10, 1).toISOString(),
      decisionJson: null,
      payloadJson: null,
    },
  ]);

  console.log("Base de exemplo pronta em", process.env.DATABASE_URL ?? "file:./data/nexo.db");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
