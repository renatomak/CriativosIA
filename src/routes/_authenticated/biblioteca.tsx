import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({ meta: [{ title: "Biblioteca — Criativos IA" }] }),
  component: Biblioteca,
});

function Biblioteca() {
  const { data = [] } = useQuery({
    queryKey: ["library"],
    queryFn: async () => (await supabase.from("creatives").select("id,duration,created_at,cost_usd,review,content,products(name)").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div>
      <h1 className="mb-6 text-4xl font-extrabold">Biblioteca</h1>
      {data.length === 0 && <p className="text-muted-foreground">Nenhum criativo gerado ainda.</p>}
      <div className="overflow-hidden rounded-xl border-2 border-foreground bg-card">
        {data.map((c) => (
          <Link key={c.id} to="/criativos/$id" params={{ id: c.id }} className="flex items-center gap-4 border-b border-border p-4 last:border-0 hover:bg-muted">
            <div className="w-12 font-display text-lg font-bold text-primary">{c.duration}s</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{(c.products as { name: string } | null)?.name}</div>
              <div className="truncate text-sm text-muted-foreground">{(c.content as { gancho?: string })?.gancho}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
              <div>US$ {Number(c.cost_usd).toFixed(4)}</div>
              <div>{c.review ? ((c.review as { aprovado: boolean }).aprovado ? "✅" : "⚠️") : "—"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
