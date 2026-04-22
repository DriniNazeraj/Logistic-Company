import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, StatusBadge } from "@/components/layout-primitives";
import { formatMoney, formatDate, shortId } from "@/lib/format";
import { ArrowLeft, Package as PackageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/cargo/$id")({
  head: () => ({
    meta: [{ title: "Detajet e ngarkeses — trans.square.al" }],
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
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      const [c, ps] = await Promise.all([
        api.cargos.get(id),
        api.packages.listByCargo(id),
      ]);
      setCargo(c);
      setPackages(ps ?? []);
      const secIds = Array.from(new Set((ps ?? []).map((p: any) => p.section_id).filter(Boolean))) as string[];
      if (secIds.length) {
        const ss = await api.sections.withWarehouse(secIds);
        setSections(ss as SectionInfo[]);
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
        title={cargo ? `${t("cargo.title")} ${cargo.cargo_code || shortId(cargo.id)}` : t("cargo.title")}
        description={
          cargo ? `${cargo.departure_country} → ${cargo.destination_country}` : undefined
        }
        actions={
          <Link
            to="/cargo"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> {t("cargoDetail.allCargos")}
          </Link>
        }
      />
      <PageBody>
        {busy || !cargo ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <DetailCard label={t("common.status")}>
                <StatusBadge status={cargo.status} />
              </DetailCard>
              <DetailCard label={t("cargoDetail.departureDate")}>
                <div className="font-mono text-sm">{formatDate(cargo.departure_date)}</div>
              </DetailCard>
              <DetailCard label={t("cargoDetail.arrivalDate")}>
                <div className="font-mono text-sm">{formatDate(cargo.arrival_date)}</div>
              </DetailCard>
              <DetailCard label={t("cargoDetail.totalsByCurrency")}>
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
                <h2 className="text-sm font-semibold">{t("cargoDetail.packagesInCargo")}</h2>
                <div className="text-xs text-muted-foreground">
                  {packages.length} {packages.length === 1 ? t("cargoDetail.package") : t("cargo.packages").toLowerCase()}
                </div>
              </div>

              {packages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
                  <PackageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("cargoDetail.noPackages")}{" "}
                    <Link to="/package" className="text-foreground underline-offset-4 hover:underline">
                      {t("cargoDetail.packagesPage")}
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <table className="w-full">
                    <thead className="bg-secondary/50">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("cargoDetail.package")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("cargoDetail.product")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("common.price")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("cargoDetail.destination")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("cargoDetail.warehouseSection")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("cargoDetail.delivery")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("cargo.arrival")}</th>
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
