import { describe, expect, it } from "vitest";
import { searchArticles } from "@/server/knowledge/search";
import type { Article } from "@/lib/domain";

const vpn: Article = {
  id: "art-vpn-809",
  title: "VPN com erro 809",
  body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10.",
  tags: ["vpn", "erro", "809"],
  windowsVersion: "10",
};

describe("central de ajuda", () => {
  it("encontra o artigo do erro 809 e avisa quando o Windows não é o coberto", () => {
    const [match] = searchArticles([vpn], "notebook não conecta na VPN erro 809", "11");
    expect(match?.id).toBe("art-vpn-809");
    expect(match?.body).toContain("Windows 11");
    expect(match?.body).toContain("abrir um chamado");
  });

  it("mantém a orientação original quando o Windows confere", () => {
    const [match] = searchArticles([vpn], "erro 809", "10");
    expect(match?.body).toContain("portal de softwares");
    expect(match?.body).not.toContain("abrir um chamado");
  });
});
