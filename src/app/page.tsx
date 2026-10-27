export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-lg border border-rule bg-paper p-8 shadow-sm">
        <p className="font-data text-xs tracking-wide text-ink-3 uppercase">Service desk de TI</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Nexo Assist</h1>
        <p className="mt-3 text-ink-2">
          O atendimento por conversa ainda está sendo montado. O próximo passo é a identificação do
          funcionário.
        </p>
      </section>
    </main>
  );
}
