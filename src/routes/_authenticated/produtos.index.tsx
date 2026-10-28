import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos/")({
  head: () => ({ meta: [{ title: "Produtos — Criativos IA" }] }),
  component: Produtos,
});

function Produtos() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("id,name,specs,created_at").order("created_at", { ascending: false })).data ?? [],
  });
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [rules, setRules] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) { toast.error("Envie pelo menos uma foto do anúncio."); return; }
    setSaving(true);
    const paths: string[] = [];
    for (const f of files) {
      const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, f);
      if (error) {
        setSaving(false);
        { toast.error("Falha no envio da foto: " + error.message); return; }
      }
      paths.push(path);
    }
    const { data, error } = await supabase
      .from("products")
      .insert({ user_id: user.id, name, description: desc, ad_link: link || null, rules: rules || null, image_paths: paths })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/produtos/$id", params: { id: data.id } });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h1 className="mb-6 text-4xl font-extrabold">Produtos</h1>
        {products.length === 0 && <p className="text-muted-foreground">Nenhum produto ainda. Cadastre o primeiro ao lado.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <Link key={p.id} to="/produtos/$id" params={{ id: p.id }} className="rounded-xl border-2 border-foreground bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="font-display text-lg font-bold">{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.specs ? "Ficha analisada" : "Aguardando análise"}</div>
            </Link>
          ))}
        </div>
      </section>
      <form onSubmit={save} className="h-fit space-y-4 rounded-xl border-2 border-foreground bg-card p-6 shadow-pop">
        <h2 className="text-2xl font-bold">Novo produto</h2>
        <div className="space-y-1.5"><Label>Nome</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Descrição do anúncio</Label><Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Link do anúncio</Label><Input type="url" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Regras específicas (opcional)</Label><Textarea rows={2} placeholder="Ex.: não mostrar modelo de rosto" value={rules} onChange={(e) => setRules(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Fotos (até 6)</Label><Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))} /></div>
        <Button className="w-full" disabled={saving}>{saving ? "Salvando..." : "Cadastrar produto"}</Button>
      </form>
    </div>
  );
}
