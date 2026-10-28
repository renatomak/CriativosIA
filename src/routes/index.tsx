import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Criativos IA — criativos para TikTok Shop" },
      { name: "description", content: "Cadastre o produto, envie as fotos e receba falas, prompts e descrições prontas para copiar." },
      { property: "og:title", content: "Criativos IA — criativos para TikTok Shop" },
      { property: "og:description", content: "Falas, prompts de fotos e vídeos e descrições fiéis ao produto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col px-6 py-10">
        <div className="font-display text-xl font-extrabold">
          Criativos<span className="text-primary">IA</span>
        </div>
        <section className="py-24">
          <p className="mb-4 inline-block rounded-full border-2 border-foreground bg-accent px-3 py-1 text-sm font-semibold">
            TikTok Shop · UGC · 8 a 20 segundos
          </p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] md:text-7xl">
            Do produto ao criativo pronto, <span className="text-primary">sem inventar nada.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Envie as fotos do anúncio, confirme a ficha técnica e receba falas, prompts de fotos e vídeos e descrição com hashtags — revisados contra riscos.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg" className="border-2 border-foreground shadow-pop">
              <Link to="/produtos">Começar</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-foreground">
              <Link to="/auth">Entrar</Link>
            </Button>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["01", "Produtos", "Cadastro e referências"],
            ["02", "Gerar", "Falas, fotos e vídeos"],
            ["03", "Revisar", "Fidelidade e conformidade"],
            ["04", "Biblioteca", "Histórico e custos"],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-xl border-2 border-foreground bg-card p-5">
              <div className="font-display text-sm text-primary">{n}</div>
              <div className="mt-2 font-display text-xl font-bold">{t}</div>
              <div className="text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
