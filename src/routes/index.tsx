import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { formatMoney } from "@/lib/format";
import { Truck, Package, Warehouse as WarehouseIcon, ArrowUpRight } from "lucide-react";
import { autoTransitPendingCargos } from "@/lib/auto-transit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — trans.al" },
      { name: "description", content: "Dashboard overview of cargos, packages and warehouses." },
    ],
  }),
  component: Index,
});

interface Stats {
  cargos: number;
  inTransit: number;
  packages: number;
  warehouses: number;
  totalsByCurrency: Record<string, number>;
}

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await autoTransitPendingCargos();
      const [c, t, w, p] = await Promise.all([
        supabase.from("cargos").select("id", { count: "exact", head: true }),
        supabase
          .from("cargos")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_transit"),
        supabase.from("warehouses").select("id", { count: "exact", head: true }),
        supabase.from("packages").select("id, price, currency"),
      ]);
      const totalsByCurrency: Record<string, number> = {};
      p.data?.forEach((x) => {
        const cur = (x as { currency?: string }).currency ?? "EUR";
        totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(x.price ?? 0);
      });
      setStats({
        cargos: c.count ?? 0,
        inTransit: t.count ?? 0,
        packages: p.data?.length ?? 0,
        warehouses: w.count ?? 0,
        totalsByCurrency,
      });
    })();
  }, [user]);

  if (!user) return null;

  const cards = [
    { label: "Total cargos", value: stats?.cargos ?? "—", to: "/cargo", icon: Truck },
    { label: "In transit", value: stats?.inTransit ?? "—", to: "/cargo", icon: ArrowUpRight, accent: true },
    { label: "Packages", value: stats?.packages ?? "—", to: "/package", icon: Package },
    { label: "Warehouses", value: stats?.warehouses ?? "—", to: "/warehouse", icon: WarehouseIcon },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="At-a-glance state of your logistics operation."
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <c.icon className={"h-4 w-4 " + (c.accent ? "text-accent" : "text-muted-foreground")} />
              </div>
              <div className="mt-3 font-mono text-3xl font-semibold tracking-tight">
                {c.value}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total package value
            </div>
            {stats && Object.keys(stats.totalsByCurrency).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {["EUR", "USD", "ALL"]
                  .filter((c) => stats.totalsByCurrency[c])
                  .map((c) => (
                    <div key={c}>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {c}
                      </div>
                      <div className="font-mono text-3xl font-semibold tracking-tight">
                        {formatMoney(stats.totalsByCurrency[c], c)}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-muted-foreground">
                —
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Sums are grouped by currency — no conversion is applied.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quick actions
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/cargo"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                + New cargo
              </Link>
              <Link
                to="/package"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                + New package
              </Link>
              <Link
                to="/warehouse"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
              >
                Design warehouse layout
              </Link>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
