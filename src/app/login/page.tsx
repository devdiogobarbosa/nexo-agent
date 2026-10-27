import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="font-display text-2xl">Nexo Assist</p>
        <div>
          <p className="text-sm text-white/70">Service desk de TI da Nexo</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-tight">Seu problema de TI, resolvido em uma conversa.</h1>
          <p className="mt-4 max-w-lg text-white/80">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.
          </p>
        </div>
        <p className="text-sm text-white/60">Beyond the Bytes · ambiente de exemplo</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="mb-6 font-display text-2xl text-ink lg:hidden">Nexo Assist</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
