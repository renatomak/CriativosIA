import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/consumo")({
  head: () => ({ meta: [{ title: "Consumo — Criativos IA" }] }),
  component: Consumo,
});

const LIMIT = 20;
const labels: Record<string, string> = { analyze: "Análise", creative: "Criativo", variant: "Nova versão", review: "Revisão" };

function Consumo() {
  const { data = [] } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => (await supabase.from("ai_usage").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const month = data.filter((u) => new Date(u.created_at) >= start);
  const spent = month.reduce((s, u) => s + Number(u.cost_usd), 0);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold">Consumo da IA</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Gasto estimado no mês" value={`US$ ${spent.toFixed(3)}`} />
        <Stat label="Limite mensal" value={`US$ ${LIMIT}`} />
        <Stat label="Chamadas no mês" value={String(month.length)} />
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-foreground bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (spent / LIMIT) * 100)}%` }} />
      </div>
      <div className="overflow-hidden rounded-xl border-2 border-foreground bg-card text-sm">
        {data.map((u) => (
          <div key={u.id} className="flex gap-4 border-b border-border p-3 last:border-0">
            <span className="w-28">{labels[u.operation] ?? u.operation}</span>
            <span className="flex-1 text-muted-foreground">{u.input_tokens} entrada · {u.output_tokens} saída</span>
            <span>US$ {Number(u.cost_usd).toFixed(4)}</span>
            <span className="w-36 text-right text-muted-foreground">{new Date(u.created_at).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-foreground bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}
