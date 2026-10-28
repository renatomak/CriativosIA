import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const nav = [
  { to: "/produtos", label: "Produtos" },
  { to: "/biblioteca", label: "Biblioteca" },
  { to: "/consumo", label: "Consumo" },
] as const;

function Layout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-foreground bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/produtos" className="font-display text-lg font-extrabold">
            Criativos<span className="text-sidebar-primary">IA</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="ml-auto flex items-center gap-1 text-sm opacity-80 hover:opacity-100">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
