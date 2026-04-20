import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, StatusBadge } from "@/components/layout-primitives";
import { formatMoney, formatDate, shortId } from "@/lib/format";
import { ArrowLeft, Package as PackageIcon } from "lucide-react";

export const Route = createFileRoute("/cargo/$id")({
  head: () => ({
    meta: [{ title: "Cargo detail — trans.al" }],
  }),
  component: CargoDetail,
});

interface Cargo {
  id: string;
  cargo_code: string;
  departure_country: string;
  destination_country: string;
  departure_date: string | null;
  arrival_date: string | null;
  status: string;
  currency: string;
}

interface Pkg {
  id: string;
  package_code: string;
  product_name: string;
  price: number;
  currency: string;
  destination_location: string | null;
  delivery_date: string | null;
  arrival_date: string | null;
  image_url: string | null;
  section_id: string | null;
}

interface SectionInfo {
  id: string;
  name: string;
  warehouse_id: string;
  warehouses?: { name: string } | null;
}

function CargoDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      const [{ data: c }, { data: ps }] = await Promise.all([
        supabase.from("cargos").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("packages")
          .select("*")
          .eq("cargo_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setCargo(c);
      setPackages(ps ?? []);
      const secIds = Array.from(new Set((ps ?? []).map((p) => p.section_id).filter(Boolean))) as string[];
      if (secIds.length) {
        const { data: ss } = await supabase
          .from("sections")
          .select("id, name, warehouse_id, warehouses(name)")
          .in("id", secIds);
        setSections((ss as SectionInfo[]) ?? []);
      } else {
        setSections([]);
      }
      setBusy(false);
    })();
  }, [id, user]);

  if (!user) return null;

  const totals: Record<string, number> = {};
  packages.forEach((p) => {
    const c = p.currency ?? "EUR";
    totals[c] = (totals[c] ?? 0) + Number(p.price ?? 0);
  });

  const sectionOf = (pkg: Pkg) => sections.find((s) => s.id === pkg.section_id);

  return (
    <>
      <PageHeader
        title={cargo ? `Cargo ${cargo.cargo_code || shortId(cargo.id)}` : "Cargo"}
        description={
          cargo ? `${cargo.departure_country} → ${cargo.destination_country}` : undefined
        }
        actions={
          <Link
            to="/cargo"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> All cargos
          </Link>
        }
      />
      <PageBody>
        {busy || !cargo ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <DetailCard label="Status">
                <StatusBadge status={cargo.status} />
              </DetailCard>
              <DetailCard label="Departure date">
                <div className="font-mono text-sm">{formatDate(cargo.departure_date)}</div>
              </DetailCard>
              <DetailCard label="Arrival date">
                <div className="font-mono text-sm">{formatDate(cargo.arrival_date)}</div>
              </DetailCard>
              <DetailCard label="Totals by currency">
                <div className="font-mono text-sm">
                  {Object.keys(totals).length === 0
                    ? "—"
                    : Object.entries(totals)
                        .map(([cur, amt]) => formatMoney(amt, cur))
                        .join(" · ")}
                </div>
              </DetailCard>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Packages in this cargo</h2>
                <div className="text-xs text-muted-foreground">
                  {packages.length} package{packages.length === 1 ? "" : "s"}
                </div>
              </div>

              {packages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
                  <PackageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No packages assigned yet. Create one from the{" "}
                    <Link to="/package" className="text-foreground underline-offset-4 hover:underline">
                      Packages page
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <table className="w-full">
                    <thead className="bg-secondary/50">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Package</th>
                        <th className="px-4 py-2.5 font-medium">Product</th>
                        <th className="px-4 py-2.5 font-medium">Price</th>
                        <th className="px-4 py-2.5 font-medium">Destination</th>
                        <th className="px-4 py-2.5 font-medium">Warehouse / Section</th>
                        <th className="px-4 py-2.5 font-medium">Delivery</th>
                        <th className="px-4 py-2.5 font-medium">Arrival</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {packages.map((p) => {
                        const sec = sectionOf(p);
                        return (
                          <tr key={p.id} className="hover:bg-secondary/30">
                            <td className="px-4 py-3 font-mono text-xs">
                              {p.package_code || shortId(p.id)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {p.image_url ? (
                                  <img
                                    src={p.image_url}
                                    alt=""
                                    className="h-7 w-7 rounded border border-border object-cover"
                                  />
                                ) : (
                                  <div className="flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary">
                                    <PackageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                  </div>
                                )}
                                <span className="truncate">{p.product_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {formatMoney(p.price, p.currency)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.destination_location ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {sec ? (
                                <>
                                  <span className="text-foreground">
                                    {sec.warehouses?.name ?? "—"}
                                  </span>
                                  <span className="mx-1">·</span>
                                  <span>{sec.name}</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(p.delivery_date)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(p.arrival_date)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

function DetailCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
