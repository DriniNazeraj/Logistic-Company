import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Select, Button, FormShell } from "@/components/ui-kit";
import { MoneyInput } from "@/components/money-input";
import { formatMoney, formatDate, shortId, Currency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package as PackageIcon, Upload, QrCode, Download, Link2, Printer, CheckSquare, Square } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { SkeletonCardGrid } from "@/components/skeleton";

export const Route = createFileRoute("/package")({
  validateSearch: (search: Record<string, unknown>): { cargo?: string } => ({
    cargo: (search.cargo as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Paketat — transport.square.al" },
      { name: "description", content: "Menaxhoni paketat individuale dhe caktoni ato ne ngarkesa." },
    ],
  }),
  component: PackagesPage,
});

type PaymentStatus = "paid" | "unpaid" | "partial";

interface Pkg {
  id: string;
  package_code: string;
  product_name: string;
  price: number;
  currency: string;
  payment_status: string;
  amount_paid: number | null;
  amount_remaining: number | null;
  destination_location: string | null;
  delivery_date: string | null;
  arrival_date: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_id_number: string | null;
  image_url: string | null;
  cargo_id: string | null;
  section_id: string | null;
  track_token: string;
}

interface CargoOpt {
  id: string;
  cargo_code: string;
  status: string;
}

interface WarehouseOpt {
  id: string;
  name: string;
}

interface SectionOpt {
  id: string;
  name: string;
  warehouse_id: string;
}

function PackagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [cargos, setCargos] = useState<CargoOpt[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const { cargo: cargoParam } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [cargoFilter, setCargoFilter] = useState(cargoParam ?? "all");
  const [qrPkg, setQrPkg] = useState<Pkg | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const { t } = useTranslation();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    const [ps, cs, ws, ss] = await Promise.all([
      api.packages.list(),
      api.cargos.list(),
      api.warehouses.list(),
      api.sections.list(),
    ]);
    setPackages(ps ?? []);
    setCargos(cs ?? []);
    setWarehouses(ws ?? []);
    setSections(ss ?? []);
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const filtered = useMemo(() => {
    let list = packages;
    if (cargoFilter !== "all") {
      list = list.filter((p) =>
        cargoFilter === "none" ? !p.cargo_id : p.cargo_id === cargoFilter,
      );
    }
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.package_code.toLowerCase().includes(q) ||
          (p.destination_location ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [packages, query, cargoFilter]);

  const remove = async (id: string) => {
    if (!confirm(t("package.deleteConfirm"))) return;
    try {
      await api.packages.delete(id);
      toast.success(t("package.packageDeleted"));
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title={t("package.title")}
        description={t("package.description")}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("package.newPackage")}
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-[2] sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("package.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="w-28 shrink-0 sm:w-auto sm:max-w-xs"
          >
            <option value="all">{t("package.allCargos")}</option>
            <option value="none">{t("common.unassigned")}</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cargo_code}
              </option>
            ))}
          </Select>
          {filtered.length > 0 && (
            <>
              <Button variant="secondary" onClick={toggleSelectAll}>
                {selected.size === filtered.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selected.size === filtered.length ? t("common.deselectAll") : t("common.selectAll")}
              </Button>
              {selected.size > 0 && (
                <Button onClick={() => setBulkPrintOpen(true)}>
                  <Printer className="h-4 w-4" /> {t("common.printLabels")} ({selected.size})
                </Button>
              )}
            </>
          )}
        </div>

        {busy ? (
          <SkeletonCardGrid count={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("package.noPackages")}
            description={t("package.noPackagesDescription")}
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> {t("package.newPackage")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const cargo = cargos.find((c) => c.id === p.cargo_id);
              const section = sections.find((s) => s.id === p.section_id);
              const warehouse = section
                ? warehouses.find((w) => w.id === section.warehouse_id)
                : null;
              return (
                <div key={p.id} className={`overflow-hidden rounded-lg border bg-card ${selected.has(p.id) ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                  <div
                    className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5"
                    onClick={() => toggleSelect(p.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">{t("common.select")}</span>
                  </div>
                  {p.image_url ? (
                    <div className="aspect-video overflow-hidden bg-secondary">
                      <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-secondary">
                      <PackageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-sm font-medium">{p.product_name}</h3>
                      <div className="font-mono text-xs">{formatMoney(p.price, p.currency)}</div>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {p.package_code || shortId(p.id)}
                    </div>
                    <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <span>{t("package.client")}</span>
                        <span className="truncate text-foreground">{p.client_name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("common.phone")}</span>
                        <span className="truncate text-foreground">{p.client_phone ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("package.payment")}</span>
                        <span className="truncate text-foreground">
                          {{ paid: t("package.paid"), unpaid: t("package.onDelivery"), partial: t("package.partly") }[p.payment_status] ?? "—"}
                        </span>
                      </div>
                      {p.payment_status === "partial" && (
                        <>
                          <div className="flex justify-between gap-2">
                            <span>{t("package.paid")}</span>
                            <span className="text-foreground">{formatMoney(p.amount_paid, p.currency)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>{t("package.remaining")}</span>
                            <span className="text-foreground">{formatMoney(p.amount_remaining, p.currency)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between gap-2">
                        <span>{t("package.cargo")}</span>
                        <span className="truncate text-foreground">{cargo?.cargo_code ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("package.warehouse")}</span>
                        <span className="truncate text-foreground">{warehouse?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("package.section")}</span>
                        <span className="truncate text-foreground">{section?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("package.destination")}</span>
                        <span className="truncate text-foreground">
                          {p.destination_location ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>{t("cargo.arrival")}</span>
                        <span className="text-foreground">{formatDate(p.arrival_date)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const url = `${window.location.origin}/track/${p.track_token}`;
                          navigator.clipboard.writeText(url);
                          toast.success(t("package.trackingCopied"));
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" onClick={() => setQrPkg(p)}>
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("package.editPackage") : t("package.newPackageTitle")}
      >
        <PackageForm
          initial={editing}
          cargos={cargos}
          warehouses={warehouses}
          sections={sections}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!qrPkg}
        onClose={() => setQrPkg(null)}
        title={t("package.qrCodeTitle")}
      >
        {qrPkg && <PackageQR pkg={qrPkg} />}
      </Modal>

      <Modal
        open={bulkPrintOpen}
        onClose={() => setBulkPrintOpen(false)}
        title={t("common.printLabels")}
      >
        <BulkPrintDialog
          packages={packages.filter((p) => selected.has(p.id))}
          onClose={() => setBulkPrintOpen(false)}
        />
      </Modal>
    </>
  );
}

const PAGE_SIZES = [
  { name: "A4", width: 210, height: 297 },
  { name: "A3", width: 297, height: 420 },
  { name: "Letter", width: 216, height: 279 },
] as const;


function BulkPrintDialog({ packages: pkgs, onClose }: { packages: Pkg[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState("A4");
  const page = PAGE_SIZES.find((p) => p.name === pageSize) ?? PAGE_SIZES[0];
  const label = { w: 96, h: 68 };

  const margin = 5; // mm page margin
  const gap = 3; // mm between labels
  const usableW = page.width - margin * 2;
  const usableH = page.height - margin * 2;
  const cols = Math.floor((usableW + gap) / (label.w + gap));
  const rows = Math.floor((usableH + gap) / (label.h + gap));
  const perPage = cols * rows;
  const totalPages = Math.ceil(pkgs.length / perPage);

  const escHtml = (s: string | null | undefined) => {
    if (!s) return "—";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const doPrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const qrSvg = (url: string, size: number) =>
      renderToStaticMarkup(<QRCodeSVG value={url} size={size} />);

    const renderLabel = (pkg: Pkg) => {
      const paymentLabel = { paid: t("package.paid"), unpaid: t("package.onDelivery"), partial: t("package.partly") }[pkg.payment_status] ?? "—";
      const trackUrl = `${window.location.origin}/track/${pkg.track_token}`;

      return `
        <div class="lbl" style="width:${label.w}mm;height:${label.h}mm;">
          <div style="height:100%;display:flex;flex-direction:column;padding:2mm;">
            <div style="display:flex;gap:2.5mm;flex:1;min-height:0;">
              <div style="width:22mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1.5px dashed #aaa;padding-right:2mm;">
                <div style="width:20mm;height:20mm;">${qrSvg(trackUrl, 150)}</div>
                <div style="font-family:monospace;font-size:7px;font-weight:bold;margin-top:1.5mm;text-align:center;word-break:break-all;">${escHtml(pkg.package_code)}</div>
              </div>
              <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-width:0;">
                <div style="background:#000;color:#fff;padding:1.5px 4px;font-size:9px;font-weight:bold;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(pkg.client_name)}</div>
                ${pkg.client_phone ? `<div style="font-size:7.5px;margin-top:1px;color:#444;">${escHtml(pkg.client_phone)}</div>` : ""}
                ${pkg.client_id_number ? `<div style="font-size:7px;color:#666;">ID: ${escHtml(pkg.client_id_number)}</div>` : ""}
                <div style="margin-top:auto;border-top:1px solid #ddd;padding-top:1.5px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;font-weight:bold;">${formatMoney(pkg.price, pkg.currency)}</span>
                    <span class="badge-${pkg.payment_status}" style="padding:0.5px 5px;border-radius:2px;font-size:7.5px;font-weight:bold;text-transform:uppercase;">${paymentLabel}</span>
                  </div>
                  ${pkg.payment_status === "partial" ? `<div style="font-size:6.5px;color:#666;">Paid: ${formatMoney(pkg.amount_paid, pkg.currency)} · Rem: ${formatMoney(pkg.amount_remaining, pkg.currency)}</div>` : ""}
                </div>
                <div style="margin-top:1.5px;font-size:7px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  <span style="font-weight:bold;">To:</span> ${escHtml(pkg.destination_location)}
                </div>
                <div style="font-size:6.5px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(pkg.product_name)}${pkg.arrival_date ? ` · ${formatDate(pkg.arrival_date)}` : ""}</div>
              </div>
            </div>
          </div>
        </div>`;
    };

    const labelsHtml = pkgs.map(renderLabel).join("\n");

    win.document.write(`
      <html><head><title>Bulk Labels</title>
      <style>
        @page { size: ${page.name}; margin: ${margin}mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; }
        .page-grid {
          display: flex;
          flex-wrap: wrap;
          gap: ${gap}mm;
          align-content: flex-start;
        }
        .lbl {
          border: 2px solid #000;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .lbl svg { width: 100%; height: 100%; display: block; }
        .badge-paid { background: #d1fae5; color: #065f46; border: 1px solid #065f46; }
        .badge-unpaid { background: #fee2e2; color: #991b1b; border: 1px solid #991b1b; }
        .badge-partial { background: #fef3c7; color: #92400e; border: 1px solid #92400e; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      </head>
      <body>
        <div class="page-grid">${labelsHtml}</div>
        <script>setTimeout(function() { window.print(); }, 300);<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-4 py-2">
      <div className="text-sm text-muted-foreground">
        {pkgs.length} {pkgs.length === 1 ? "label" : "labels"} selected
      </div>
      <Field label={t("common.pageSize")}>
        <Select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
          {PAGE_SIZES.map((s) => (
            <option key={s.name} value={s.name}>{s.name} ({s.width}×{s.height}mm)</option>
          ))}
        </Select>
      </Field>
      <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold">{perPage}</div>
            <div className="text-xs text-muted-foreground">per page</div>
          </div>
          <div>
            <div className="text-lg font-bold">{totalPages}</div>
            <div className="text-xs text-muted-foreground">{totalPages === 1 ? "page" : "pages"}</div>
          </div>
          <div>
            <div className="text-lg font-bold">{cols}×{rows}</div>
            <div className="text-xs text-muted-foreground">grid</div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={doPrint}>
          <Printer className="h-4 w-4" /> {t("common.print")} {pkgs.length} {pkgs.length === 1 ? "label" : "labels"}
        </Button>
      </div>
    </div>
  );
}

function PackageQR({ pkg }: { pkg: Pkg }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const paymentLabel = { paid: t("package.paid"), unpaid: t("package.onDelivery"), partial: t("package.partly") }[pkg.payment_status] ?? "—";

  const trackUrl = `${window.location.origin}/track/${pkg.track_token}`;

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `${pkg.package_code || "package"}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const printQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;

    const escHtml = (s: string | null | undefined) => {
      if (!s) return "—";
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    win.document.write(`
      <html><head><title>Label - ${pkg.package_code}</title>
      <style>
        @page { size: 100mm 150mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100mm; height: 150mm; overflow: hidden; font-family: Arial, Helvetica, sans-serif; margin: 0; }
        .label {
          border: 3px solid #000;
          padding: 2mm 3mm;
          width: 100mm;
          height: 150mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 3px;
          margin-bottom: 3px;
        }
        .header h1 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
        .header .code { font-family: monospace; font-size: 15px; font-weight: bold; margin-top: 1px; }
        .qr-section {
          text-align: center;
          padding: 3px 0;
          border-bottom: 1.5px dashed #000;
          margin-bottom: 3px;
        }
        .qr-section svg { width: 100px; height: 100px; }
        .recipient {
          background: #000;
          color: #fff;
          padding: 4px 6px;
          margin-bottom: 3px;
          text-align: center;
        }
        .recipient .name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
        .recipient .phone { font-size: 10px; margin-top: 1px; }
        .payment-row {
          text-align: center;
          padding: 3px 0;
          border-bottom: 1.5px solid #000;
          margin-bottom: 3px;
        }
        .price { font-size: 16px; font-weight: bold; }
        .payment-badge {
          display: inline-block;
          padding: 1px 8px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .paid { background: #d1fae5; color: #065f46; border: 1px solid #065f46; }
        .unpaid { background: #fee2e2; color: #991b1b; border: 1px solid #991b1b; }
        .partial { background: #fef3c7; color: #92400e; border: 1px solid #92400e; }
        .info { flex: 1; min-height: 0; overflow: hidden; }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 1.5px 0;
          font-size: 9px;
        }
        .info-row .lbl { font-weight: bold; text-transform: uppercase; font-size: 8px; color: #333; }
        .info-row .val { font-weight: 600; }
        .footer { text-align: center; font-size: 7px; color: #999; padding-top: 2px; border-top: 1px solid #ddd; }
        @media print {
          html, body { width: 100mm; height: 150mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style></head>
      <body>
        <div class="label">
          <div class="header">
            <h1>Shipping Label</h1>
            <div class="code">${escHtml(pkg.package_code)}</div>
          </div>
          <div class="qr-section">${svgData}</div>
          <div class="recipient">
            <div class="name">${escHtml(pkg.client_name)}</div>
            ${pkg.client_phone ? `<div class="phone">${escHtml(pkg.client_phone)}</div>` : ""}
            ${pkg.client_id_number ? `<div class="phone">ID: ${escHtml(pkg.client_id_number)}</div>` : ""}
          </div>
          <div class="payment-row">
            <div class="price">${formatMoney(pkg.price, pkg.currency)}</div>
            <span class="payment-badge ${pkg.payment_status}">${paymentLabel}</span>
            ${pkg.payment_status === "partial" ? `<div style="font-size:9px;margin-top:2px">Paid: ${formatMoney(pkg.amount_paid, pkg.currency)} · Rem: ${formatMoney(pkg.amount_remaining, pkg.currency)}</div>` : ""}
          </div>
          <div class="info">
            <div class="info-row"><span class="lbl">Product</span><span class="val">${escHtml(pkg.product_name)}</span></div>
            <div class="info-row"><span class="lbl">Destination</span><span class="val">${escHtml(pkg.destination_location)}</span></div>
            ${pkg.arrival_date ? `<div class="info-row"><span class="lbl">Arrival</span><span class="val">${formatDate(pkg.arrival_date)}</span></div>` : ""}
            ${pkg.delivery_date ? `<div class="info-row"><span class="lbl">Delivery</span><span class="val">${formatDate(pkg.delivery_date)}</span></div>` : ""}
          </div>
          <div class="footer">transport.square.al · ${new Date().toLocaleDateString()}</div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div ref={qrRef} className="rounded-lg border border-border bg-white p-4">
        <QRCodeSVG value={trackUrl} size={200} />
      </div>
      <div className="text-center">
        <div className="font-medium">{pkg.product_name}</div>
        <div className="font-mono text-xs text-muted-foreground">{pkg.package_code}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {formatMoney(pkg.price, pkg.currency)} &middot; {paymentLabel}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={downloadQR}>
          <Download className="h-3.5 w-3.5" /> {t("common.downloadPNG")}
        </Button>
        <Button onClick={printQR}>
          {t("common.print")}
        </Button>
      </div>
    </div>
  );
}

function PackageForm({
  initial,
  cargos,
  warehouses,
  sections,
  onSaved,
}: {
  initial: Pkg | null;
  cargos: CargoOpt[];
  warehouses: WarehouseOpt[];
  sections: SectionOpt[];
  onSaved: () => void;
}) {
  const initialSection = initial ? sections.find((s) => s.id === initial.section_id) : null;
  const [code, setCode] = useState(initial?.package_code ?? "");
  const [name, setName] = useState(initial?.product_name ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? "USD");
  const validStatuses: PaymentStatus[] = ["paid", "unpaid", "partial"];
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    validStatuses.includes(initial?.payment_status as PaymentStatus) ? (initial!.payment_status as PaymentStatus) : "paid"
  );
  const [amountPaid, setAmountPaid] = useState(String(initial?.amount_paid ?? ""));
  const [amountRemaining, setAmountRemaining] = useState(String(initial?.amount_remaining ?? ""));
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.client_phone ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.client_email ?? "");
  const [clientIdNumber, setClientIdNumber] = useState(initial?.client_id_number ?? "");
  const [dest, setDest] = useState(initial?.destination_location ?? "");
  const [delivery, setDelivery] = useState(initial?.delivery_date?.slice(0, 10) ?? "");
  const [arrival, setArrival] = useState(initial?.arrival_date?.slice(0, 10) ?? "");
  const [cargoId, setCargoId] = useState(initial?.cargo_id ?? "");
  const [warehouseId, setWarehouseId] = useState(initialSection?.warehouse_id ?? "");
  const [sectionId, setSectionId] = useState(initial?.section_id ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const availableSections = useMemo(
    () => (warehouseId ? sections.filter((s) => s.warehouse_id === warehouseId) : []),
    [warehouseId, sections],
  );

  const onWarehouseChange = (wid: string) => {
    setWarehouseId(wid);
    if (!sections.find((s) => s.id === sectionId && s.warehouse_id === wid)) {
      setSectionId("");
    }
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("package.onlyImages"));
      return;
    }
    setUploading(true);
    try {
      const url = await api.upload(file);
      setImageUrl(url);
      toast.success(t("package.imageUploaded"));
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploading(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("package.productNameRequired"));
    if (!clientName.trim()) return toast.error(t("package.clientNameRequired"));
    if (!delivery) return toast.error(t("package.deliveryDateRequired"));
    if (!arrival) return toast.error(t("package.arrivalDateRequired"));
    if (delivery && arrival && new Date(arrival) < new Date(delivery)) return toast.error(t("package.arrivalBeforeDelivery"));
    if (!warehouseId) return toast.error(t("package.warehouseRequired"));
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return toast.error(t("login.invalidEmail"));
    setBusy(true);
    const payload = {
      package_code: code || `PKG-${Date.now().toString(36).toUpperCase()}`,
      product_name: name,
      price: Number(price) || 0,
      currency,
      payment_status: paymentStatus,
      amount_paid: paymentStatus === "partial" ? Number(amountPaid) || 0 : undefined,
      amount_remaining: paymentStatus === "partial" ? Number(amountRemaining) || 0 : undefined,
      client_name: clientName || undefined,
      client_phone: clientPhone || undefined,
      client_email: clientEmail || undefined,
      client_id_number: clientIdNumber || undefined,
      destination_location: dest || undefined,
      delivery_date: delivery || undefined,
      arrival_date: arrival || undefined,
      cargo_id: cargoId || undefined,
      section_id: sectionId || undefined,
      image_url: imageUrl || undefined,
    };
    try {
      if (initial) {
        await api.packages.update(initial.id, payload);
      } else {
        await api.packages.create(payload);
      }
      toast.success(initial ? t("package.packageUpdated") : t("package.packageCreated"));
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("package.packageCode")} hint={t("package.autoIfBlank")}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PKG-001" />
        </Field>
        <Field label={t("common.price")}>
          <MoneyInput
            amount={price}
            currency={currency}
            onAmountChange={setPrice}
            onCurrencyChange={setCurrency}
          />
        </Field>
      </div>
      <Field label={t("package.paymentStatus")}>
        <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
          <option value="paid">{t("package.paid")}</option>
          <option value="unpaid">{t("package.onDelivery")}</option>
          <option value="partial">{t("package.partly")}</option>
        </Select>
      </Field>
      {paymentStatus === "partial" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("package.amountPaid")}>
            <Input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => {
                const paid = e.target.value;
                setAmountPaid(paid);
                const total = Number(price) || 0;
                const remaining = total - (Number(paid) || 0);
                setAmountRemaining(remaining > 0 ? String(remaining) : "0");
              }}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label={t("package.remainingOnDelivery")}>
            <Input
              type="number"
              step="0.01"
              readOnly
              value={amountRemaining}
              onChange={(e) => setAmountRemaining(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
        </div>
      )}
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pt-2">
        {t("package.clientInfo")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("package.fullName")}>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Doe" required />
        </Field>
        <Field label={t("common.idNumber")}>
          <Input value={clientIdNumber} onChange={(e) => setClientIdNumber(e.target.value)} placeholder="A12345678" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("package.phoneNumber")}>
          <Input type="tel" inputMode="numeric" value={clientPhone} onKeyDown={(e) => { if (/[a-zA-Z]/.test(e.key) && e.key.length === 1) e.preventDefault(); }} onChange={(e) => setClientPhone(e.target.value.replace(/[a-zA-Z]/g, ""))} placeholder="+355 69 123 4567" required />
        </Field>
        <Field label={t("common.email")} hint={t("package.emailOptional")}>
          <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
        </Field>
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pt-2">
        {t("package.productDetails")}
      </div>
      <Field label={t("package.productName")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t("package.destinationLocation")}>
        <Input
          value={dest ?? ""}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Tirana, Rruga Kavajës"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("package.deliveryDate")}>
          <Input
            type="date"
            value={delivery ?? ""}
            onChange={(e) => {
              setDelivery(e.target.value);
              if (arrival && e.target.value && new Date(arrival) < new Date(e.target.value)) {
                setArrival(e.target.value);
              }
            }}
            required
          />
        </Field>
        <Field label={t("package.arrivalDate")}>
          <Input
            type="date"
            value={arrival ?? ""}
            min={delivery || undefined}
            onChange={(e) => setArrival(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label={t("package.relatedCargo")} hint={t("package.pendingOnly")}>
        <Select value={cargoId ?? ""} onChange={(e) => setCargoId(e.target.value)}>
          <option value="">{t("common.unassigned")}</option>
          {cargos
            .filter((c) => c.status === "pending" || c.id === initial?.cargo_id)
            .map((c) => (
              <option key={c.id} value={c.id} disabled={c.status !== "pending"}>
                {c.cargo_code}{c.status !== "pending" ? ` (${c.status.replace("_", " ")})` : ""}
              </option>
            ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("package.warehouse")}>
          <Select value={warehouseId} onChange={(e) => onWarehouseChange(e.target.value)} required>
            <option value="">{t("common.none")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("package.section")}
          hint={!warehouseId ? t("package.selectWarehouseFirst") : undefined}
        >
          <Select
            value={sectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!warehouseId}
          >
            <option value="">{t("common.none")}</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("package.productImage")}>
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border bg-secondary">
              <PackageIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? t("common.uploading") : imageUrl ? t("common.replace") : t("common.upload")}
          </Button>
          {imageUrl && (
            <Button type="button" variant="ghost" onClick={() => setImageUrl("")}>
              {t("common.remove")}
            </Button>
          )}
        </div>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : initial ? t("common.saveChanges") : t("package.createPackage")}
        </Button>
      </div>
    </FormShell>
  );
}
