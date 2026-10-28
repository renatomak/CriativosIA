import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeProduct, createCreative } from "@/lib/creatives.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produtos/$id")({
  head: () => ({ meta: [{ title: "Produto — Criativos IA" }] }),
  component: ProductPage,
});

type Spec = { categoria: string; confirmadas: { atributo: string; valor: string }[]; incertas: { atributo: string; valor: string; motivo: string }[] };

function ProductPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeProduct);
  const create = useServerFn(createCreative);
  const { data: p } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).single();
      if (!data) return null;
      const urls = await Promise.all(
        data.image_paths.map(async (path) => (await supabase.storage.from("product-images").createSignedUrl(path, 3600)).data?.signedUrl ?? ""),
      );
      return { ...data, urls };
    },
  });
  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives", id],
    queryFn: async () => (await supabase.from("creatives").select("id,duration,created_at,review,content").eq("product_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const [spec, setSpec] = useState<Spec | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [duration, setDuration] = useState<8 | 10 | 16 | 20>(20);
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (p?.specs) setSpec(p.specs as unknown as Spec);
  }, [p?.specs]);

  if (!p) return <p className="text-muted-foreground">Carregando...</p>;

  async function runAnalyze() {
    setBusy("analyze");
    try {
      const r = await analyze({ data: { id } });
      setSpec(r as Spec);
      qc.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Ficha técnica gerada. Revise e confirme.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  }
  async function saveSpec() {
    await supabase.from("products").update({ specs: spec as never }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["product", id] });
    toast.success("Ficha confirmada.");
  }
  async function generate() {
    setBusy("gen");
    try {
      const r = await create({ data: { productId: id, duration, instructions: extra || undefined } });
      navigate({ to: "/criativos/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }
  const upd = (fn: (s: Spec) => void) => setSpec((s) => { if (!s) return s; const c = structuredClone(s); fn(c); return c; });

  return (
    <div className="space-y-8">
      <div>
        <Link to="/produtos" className="text-sm text-muted-foreground">← Produtos</Link>
        <h1 className="text-4xl font-extrabold">{p.name}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{p.description}</p>
        {p.rules && <p className="mt-2 text-sm"><b>Regras:</b> {p.rules}</p>}
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {p.urls.map((u) => <img key={u} src={u} alt={p.name} className="h-40 w-40 flex-none rounded-lg border-2 border-foreground object-cover" />)}
      </div>

      <section className="rounded-xl border-2 border-foreground bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">Ficha técnica</h2>
          <Button variant="outline" onClick={runAnalyze} disabled={!!busy}>
            {busy === "analyze" && <Loader2 className="h-4 w-4 animate-spin" />} {spec ? "Reanalisar" : "Analisar com IA"}
          </Button>
          {spec && <Button onClick={saveSpec}>Confirmar ficha</Button>}
        </div>
        {!spec ? (
          <p className="text-muted-foreground">Analise o produto para extrair cores, materiais, etiquetas e quantidades.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-bold text-success">Confirmadas</h3>
              {spec.confirmadas.map((c, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <Input value={c.atributo} onChange={(e) => upd((s) => { s.confirmadas[i]!.atributo = e.target.value; })} className="w-1/3" />
                  <Input value={c.valor} onChange={(e) => upd((s) => { s.confirmadas[i]!.valor = e.target.value; })} />
                  <Button size="icon" variant="ghost" onClick={() => upd((s) => { s.confirmadas.splice(i, 1); })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => upd((s) => { s.confirmadas.push({ atributo: "", valor: "" }); })}><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            <div>
              <h3 className="mb-2 font-bold text-warning">Incertas (não serão usadas como fato)</h3>
              {spec.incertas.map((c, i) => (
                <div key={i} className="mb-2 rounded-lg bg-muted p-2 text-sm">
                  <b>{c.atributo}:</b> {c.valor} <span className="text-muted-foreground">— {c.motivo}</span>
                  <div className="mt-1 flex gap-2">
                    <button className="text-xs underline" onClick={() => upd((s) => { const [x] = s.incertas.splice(i, 1); if (x) s.confirmadas.push({ atributo: x.atributo, valor: x.valor }); })}>Confirmar</button>
                    <button className="text-xs underline" onClick={() => upd((s) => { s.incertas.splice(i, 1); })}>Descartar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border-2 border-foreground bg-accent p-6 shadow-pop">
        <h2 className="mb-4 text-2xl font-bold text-accent-foreground">Gerar criativo</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {([8, 10, 16, 20] as const).map((d) => (
            <Button key={d} variant={duration === d ? "default" : "outline"} onClick={() => setDuration(d)}>{d}s</Button>
          ))}
        </div>
        <Label>Instruções extras (opcional)</Label>
        <Textarea rows={2} className="mb-4 bg-card" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <Button size="lg" onClick={generate} disabled={!!busy || !p.specs}>
          {busy === "gen" && <Loader2 className="h-4 w-4 animate-spin" />} {busy === "gen" ? "Gerando (pode levar ~1 min)..." : "Gerar criativo completo"}
        </Button>
        {!p.specs && <p className="mt-2 text-sm text-accent-foreground">Confirme a ficha técnica primeiro.</p>}
      </section>

      {creatives.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-bold">Criativos deste produto</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creatives.map((c) => (
              <Link key={c.id} to="/criativos/$id" params={{ id: c.id }} className="rounded-xl border-2 border-foreground bg-card p-4 hover:shadow-pop">
                <div className="text-xs text-muted-foreground">{c.duration}s · {new Date(c.created_at).toLocaleString("pt-BR")}</div>
                <div className="mt-1 line-clamp-2 font-medium">{(c.content as { gancho?: string })?.gancho}</div>
                <div className="mt-2 text-xs">{c.review ? ((c.review as { aprovado: boolean }).aprovado ? "✅ Revisado" : "⚠️ Com alertas") : "Sem revisão"}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
