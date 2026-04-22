import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { formatMoney, convertTotals, loadExchangeRates, type Currency } from "@/lib/format";
import { Truck, Package, Warehouse as WarehouseIcon, ArrowUpRight } from "lucide-react";
import { autoTransitPendingCargos } from "@/lib/auto-transit";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

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
  cargoByStatus: { name: string; value: number }[];
  packagesByDay: { day: string; count: number }[];
}

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981"];

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const overviewCurrency = (localStorage.getItem("overview_currency") as Currency) || "USD";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await autoTransitPendingCargos();
      const [counts, pkgs, allCargos, allPkgs] = await Promise.all([
        api.cargos.stats(),
        api.packages.listSummary(),
        api.cargos.list(),
        api.packages.list(),
      ]);
      const totalsByCurrency: Record<string, number> = {};
      pkgs.forEach((x: any) => {
        const cur = x.currency ?? "EUR";
        totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(x.price ?? 0);
      });

      // Cargo by status
      const statusCounts: Record<string, number> = { pending: 0, in_transit: 0, delivered: 0 };
      allCargos.forEach((r: any) => {
        const s = r.status;
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      });
      const cargoByStatus = [
        { name: "Pending", value: statusCounts.pending },
        { name: "In Transit", value: statusCounts.in_transit },
        { name: "Delivered", value: statusCounts.delivered },
      ].filter((d) => d.value > 0);

      // Packages created per day (last 7 days)
      const today = new Date();
      const days: { day: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count: 0 });
      }
      allPkgs.forEach((r: any) => {
        const created = new Date(r.created_at);
        const diff = Math.floor((today.getTime() - created.getTime()) / 86400000);
        if (diff >= 0 && diff < 7) {
          days[6 - diff].count += 1;
        }
      });

      setStats({
        cargos: counts.total,
        inTransit: counts.inTransit,
        packages: pkgs.length,
        warehouses: counts.warehouses,
        totalsByCurrency,
        cargoByStatus,
        packagesByDay: days,
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
              <div className="mt-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                {c.value}
              </div>
            </Link>
          ))}
        </div>

        {/* Charts row */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Packages per day bar chart */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Packages — last 7 days
            </div>
            {stats && stats.packagesByDay.length > 0 ? (
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.packagesByDay} barSize={28}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
                    />
                    <Bar dataKey="count" name="Packages" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 flex h-52 items-center justify-center text-sm text-muted-foreground">No data yet</div>
            )}
          </div>

          {/* Cargo status pie chart */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cargo status breakdown
            </div>
            {stats && stats.cargoByStatus.length > 0 ? (
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.cargoByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.cargoByStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "var(--foreground)" }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ color: "var(--foreground)", fontSize: 12 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 flex h-52 items-center justify-center text-sm text-muted-foreground">No cargos yet</div>
            )}
          </div>
        </div>

        {/* Bottom row: totals + quick actions */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total package value
            </div>
            {stats && Object.keys(stats.totalsByCurrency).length > 0 ? (
              <>
                <div className="mt-3 border-b border-border pb-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total ({overviewCurrency})
                  </div>
                  <div className="font-mono text-2xl font-semibold tracking-tight sm:text-4xl">
                    {formatMoney(convertTotals(stats.totalsByCurrency, overviewCurrency), overviewCurrency)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {["EUR", "USD", "ALL"]
                    .filter((c) => stats.totalsByCurrency[c])
                    .map((c) => (
                      <div key={c}>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {c}
                        </div>
                        <div className="font-mono text-lg font-semibold tracking-tight text-muted-foreground sm:text-2xl">
                          {formatMoney(stats.totalsByCurrency[c], c)}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">
                —
              </div>
            )}
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
