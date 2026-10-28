import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createVariant, reviewCreative } from "@/lib/creatives.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/criativos/$id")({
  head: () => ({ meta: [{ title: "Criativo — Criativos IA" }] }),
  component: CreativePage,
});

type Scene = { numero: number; duracao_segundos: number; fala: string; texto_na_tela: string; roteiro_ugc: string; prompt_imagem: string; prompt_video: string };
type Content = { gancho: string; cenas: Scene[]; descricao: string; hashtags: string[] };
type Review = { aprovado: boolean; resumo: string; alertas: { gravidade: string; tipo: string; trecho: string; sugestao: string }[] };

function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copiado!"); }} className="text-muted-foreground hover:text-primary" aria-label={`Copiar ${label}`}>
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function CreativePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const review = useServerFn(reviewCreative);
  const variant = useServerFn(createVariant);
  const [busy, setBusy] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const { data: c } = useQuery({
    queryKey: ["creative", id],
    queryFn: async () => (await supabase.from("creatives").select("*, products(name)").eq("id", id).single()).data,
  });
  if (!c) return <p className="text-muted-foreground">Carregando...</p>;
  const content = c.content as unknown as Content;
  const rv = c.review as unknown as Review | null;
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  async function runReview() {
    setBusy("review");
    try { await review({ data: { id } }); qc.invalidateQueries({ queryKey: ["creative", id] }); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }
  async function runVariant() {
    setBusy("variant");
    try { const r = await variant({ data: { id, instructions: extra || undefined } }); navigate({ to: "/criativos/$id", params: { id: r.id } }); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/produtos/$id" params={{ id: c.product_id }} className="text-sm text-muted-foreground">← {(c.products as { name: string } | null)?.name}</Link>
        <h1 className="text-4xl font-extrabold">Criativo de {c.duration}s</h1>
        <p className="text-sm text-muted-foreground">Custo estimado: US$ {Number(c.cost_usd).toFixed(4)} · {c.model}{c.parent_id ? " · nova versão" : ""}</p>
      </div>

      <div className="rounded-xl border-2 border-foreground bg-primary p-5 text-primary-foreground shadow-pop">
        <div className="text-xs font-semibold uppercase">Gancho (3 primeiros segundos)</div>
        <div className="font-display text-2xl font-bold">{content.gancho}</div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {content.cenas.map((s) => (
          <section key={s.numero} className="space-y-3 rounded-xl border-2 border-foreground bg-card p-5">
            <h2 className="text-xl font-bold">Cena {s.numero} · {s.duracao_segundos}s</h2>
            <CopyBlock label={`Fala (${words(s.fala)} palavras)`} text={s.fala} />
            <CopyBlock label="Texto na tela" text={s.texto_na_tela} />
            <CopyBlock label="Roteiro UGC" text={s.roteiro_ugc} />
            <CopyBlock label="Prompt de imagem" text={s.prompt_imagem} />
            <CopyBlock label="Prompt de vídeo" text={s.prompt_video} />
          </section>
        ))}
      </div>

      <section className="rounded-xl border-2 border-foreground bg-card p-5">
        <h2 className="mb-3 text-xl font-bold">Descrição</h2>
        <CopyBlock label={`Descrição + ${content.hashtags.length} hashtags`} text={`${content.descricao}\n\n${content.hashtags.join(" ")}`} />
      </section>

      <section className="rounded-xl border-2 border-foreground bg-card p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-xl font-bold">Revisão de fidelidade e riscos</h2>
          <Button variant="outline" onClick={runReview} disabled={!!busy}>
            {busy === "review" && <Loader2 className="h-4 w-4 animate-spin" />} {rv ? "Revisar de novo" : "Revisar agora"}
          </Button>
        </div>
        {!rv ? <p className="text-muted-foreground">Revise antes de publicar.</p> : (
          <div className="space-y-2">
            <p className={rv.aprovado ? "font-semibold text-success" : "font-semibold text-destructive"}>{rv.aprovado ? "✅ Aprovado" : "⚠️ Requer atenção"} — {rv.resumo}</p>
            {rv.alertas.map((a, i) => (
              <div key={i} className="rounded-lg bg-muted p-3 text-sm">
                <b className={a.gravidade === "alta" ? "text-destructive" : ""}>[{a.gravidade}] {a.tipo.replace(/_/g, " ")}</b>: “{a.trecho}”
                <div className="text-muted-foreground">Sugestão: {a.sugestao}</div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">A revisão humana final é sempre necessária antes de publicar.</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border-2 border-foreground bg-accent p-5">
        <h2 className="mb-3 text-xl font-bold text-accent-foreground">Gerar nova versão</h2>
        <Textarea rows={2} className="mb-3 bg-card" placeholder="Ex.: gancho mais engraçado" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <Button onClick={runVariant} disabled={!!busy}>
          {busy === "variant" && <Loader2 className="h-4 w-4 animate-spin" />} {busy === "variant" ? "Gerando..." : "Gerar nova versão"}
        </Button>
      </section>
    </div>
  );
}
