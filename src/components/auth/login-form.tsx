"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("ana.souza@nexo.com.br");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const body = (await response.json()) as { error?: string; role?: string };
      if (!response.ok) {
        setError(body.error ?? "Não foi possível entrar.");
        return;
      }
      router.push(body.role === "analista" ? "/console" : "/atendimento");
      router.refresh();
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl text-ink">Entrar</h1>
        <p className="mt-2 text-ink-2">Use seu e-mail corporativo e a senha da rede Nexo.</p>
      </div>
      <label className="block text-sm text-ink-2">
        E-mail corporativo
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-cta"
          required
        />
      </label>
      <label className="block text-sm text-ink-2">
        Senha
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-cta"
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
        Manter conectado neste computador
      </label>
      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-text">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-cta px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-sm text-ink-3">
        Esqueceu a senha? Ligue no ramal 4000. No ambiente de exemplo, qualquer senha não vazia entra se o e-mail existir.
      </p>
    </form>
  );
}
