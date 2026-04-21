import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Select, Button, FormShell } from "@/components/ui-kit";
import { MoneyInput } from "@/components/money-input";
import { formatMoney, formatDate, shortId, Currency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package as PackageIcon, Upload, QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/package")({
  validateSearch: (search: Record<string, unknown>): { cargo?: string } => ({
    cargo: (search.cargo as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Packages — trans.al" },
      { name: "description", content: "Manage individual packages and assign them to cargos." },
    ],
  }),
  component: PackagesPage,
});

type PaymentStatus = "paid" | "on_delivery" | "partly";

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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    const [{ data: ps }, { data: cs }, { data: ws }, { data: ss }] = await Promise.all([
      supabase.from("packages").select("*").order("created_at", { ascending: false }),
      supabase.from("cargos").select("id, cargo_code, status").order("created_at", { ascending: false }),
      supabase.from("warehouses").select("id, name").order("name"),
      supabase.from("sections").select("id, name, warehouse_id").order("name"),
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
    if (!confirm("Delete this package?")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Package deleted");
    load();
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Packages"
        description="Individual items inside cargo shipments."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New package
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search packages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="max-w-xs"
          >
            <option value="all">All cargos</option>
            <option value="none">Unassigned</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cargo_code}
              </option>
            ))}
          </Select>
        </div>

        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No packages"
            description="Create packages and assign them to a cargo."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New package
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
                <div key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
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
                        <span>Client</span>
                        <span className="truncate text-foreground">{p.client_name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Phone</span>
                        <span className="truncate text-foreground">{p.client_phone ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Payment</span>
                        <span className="truncate text-foreground">
                          {{ paid: "Paid", on_delivery: "On delivery", partly: "Partly" }[p.payment_status] ?? "—"}
                        </span>
                      </div>
                      {p.payment_status === "partly" && (
                        <>
                          <div className="flex justify-between gap-2">
                            <span>Paid</span>
                            <span className="text-foreground">{formatMoney(p.amount_paid, p.currency)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Remaining</span>
                            <span className="text-foreground">{formatMoney(p.amount_remaining, p.currency)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between gap-2">
                        <span>Cargo</span>
                        <span className="truncate text-foreground">{cargo?.cargo_code ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Warehouse</span>
                        <span className="truncate text-foreground">{warehouse?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Section</span>
                        <span className="truncate text-foreground">{section?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Destination</span>
                        <span className="truncate text-foreground">
                          {p.destination_location ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Arrival</span>
                        <span className="text-foreground">{formatDate(p.arrival_date)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
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
        title={editing ? "Edit package" : "New package"}
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
        title="Package QR Code"
      >
        {qrPkg && <PackageQR pkg={qrPkg} />}
      </Modal>
    </>
  );
}

function PackageQR({ pkg }: { pkg: Pkg }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const paymentLabel = { paid: "Paid", on_delivery: "On delivery", partly: "Partly" }[pkg.payment_status] ?? "—";

  const trackUrl = `${window.location.origin}/track/${encodeURIComponent(pkg.package_code)}`;

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
    win.document.write(`
      <html><head><title>QR - ${pkg.package_code}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;margin:0}
      h2{margin:0 0 4px}p{margin:0;color:#666;font-size:14px}.code{font-family:monospace;font-size:13px;color:#888;margin-top:2px}</style></head>
      <body>
        ${svgData}
        <h2 style="margin-top:16px">${pkg.product_name}</h2>
        <p class="code">${pkg.package_code}</p>
        <p style="margin-top:8px">${formatMoney(pkg.price, pkg.currency)} &middot; ${paymentLabel}</p>
        ${pkg.destination_location ? `<p>${pkg.destination_location}</p>` : ""}
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
          <Download className="h-3.5 w-3.5" /> Download PNG
        </Button>
        <Button onClick={printQR}>
          Print
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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>((initial?.payment_status as PaymentStatus) ?? "paid");
  const [amountPaid, setAmountPaid] = useState(String(initial?.amount_paid ?? ""));
  const [amountRemaining, setAmountRemaining] = useState(String(initial?.amount_remaining ?? ""));
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.client_phone ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.client_email ?? "");
  const [clientIdNumber, setClientIdNumber] = useState(initial?.client_id_number ?? "");
  const [dest, setDest] = useState(initial?.destination_location ?? "");
  const [delivery, setDelivery] = useState(initial?.delivery_date ?? "");
  const [arrival, setArrival] = useState(initial?.arrival_date ?? "");
  const [cargoId, setCargoId] = useState(initial?.cargo_id ?? "");
  const [warehouseId, setWarehouseId] = useState(initialSection?.warehouse_id ?? "");
  const [sectionId, setSectionId] = useState(initial?.section_id ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const availableSections = useMemo(
    () => (warehouseId ? sections.filter((s) => s.warehouse_id === warehouseId) : []),
    [warehouseId, sections],
  );

  const onWarehouseChange = (wid: string) => {
    setWarehouseId(wid);
    // Clear section if it no longer belongs to the selected warehouse
    if (!sections.find((s) => s.id === sectionId && s.warehouse_id === wid)) {
      setSectionId("");
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("package-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("package-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
    toast.success("Image uploaded");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      package_code: code || `PKG-${Date.now().toString(36).toUpperCase()}`,
      product_name: name,
      price: Number(price) || 0,
      currency,
      payment_status: paymentStatus,
      amount_paid: paymentStatus === "partly" ? Number(amountPaid) || 0 : null,
      amount_remaining: paymentStatus === "partly" ? Number(amountRemaining) || 0 : null,
      client_name: clientName || null,
      client_phone: clientPhone || null,
      client_email: clientEmail || null,
      client_id_number: clientIdNumber || null,
      destination_location: dest || null,
      delivery_date: delivery || null,
      arrival_date: arrival || null,
      cargo_id: cargoId || null,
      section_id: sectionId || null,
      image_url: imageUrl || null,
    };
    const { error } = initial
      ? await supabase.from("packages").update(payload).eq("id", initial.id)
      : await supabase.from("packages").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Package updated" : "Package created");
    onSaved();
  };

  return (
    <FormShell onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Package code" hint="Auto if blank.">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PKG-001" />
        </Field>
        <Field label="Price">
          <MoneyInput
            amount={price}
            currency={currency}
            onAmountChange={setPrice}
            onCurrencyChange={setCurrency}
          />
        </Field>
      </div>
      <Field label="Payment status">
        <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
          <option value="paid">Paid</option>
          <option value="on_delivery">Pay on delivery</option>
          <option value="partly">Partly</option>
        </Select>
      </Field>
      {paymentStatus === "partly" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount paid">
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
          <Field label="Remaining on delivery">
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
        Client information
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name">
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Doe" required />
        </Field>
        <Field label="ID number">
          <Input value={clientIdNumber} onChange={(e) => setClientIdNumber(e.target.value)} placeholder="A12345678" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone number">
          <Input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+355 69 123 4567" required />
        </Field>
        <Field label="Email" hint="Optional">
          <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
        </Field>
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pt-2">
        Product details
      </div>
      <Field label="Product name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Destination location">
        <Input
          value={dest ?? ""}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Tirana, Rruga Kavajës"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Delivery date">
          <Input
            type="date"
            value={delivery ?? ""}
            onChange={(e) => setDelivery(e.target.value)}
          />
        </Field>
        <Field label="Arrival date">
          <Input
            type="date"
            value={arrival ?? ""}
            onChange={(e) => setArrival(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Related cargo" hint="Only pending cargos can be assigned.">
        <Select value={cargoId ?? ""} onChange={(e) => setCargoId(e.target.value)}>
          <option value="">Unassigned</option>
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
        <Field label="Warehouse">
          <Select value={warehouseId} onChange={(e) => onWarehouseChange(e.target.value)}>
            <option value="">None</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Section"
          hint={!warehouseId ? "Select a warehouse first." : undefined}
        >
          <Select
            value={sectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!warehouseId}
          >
            <option value="">None</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Product image">
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
            {uploading ? "Uploading…" : imageUrl ? "Replace" : "Upload"}
          </Button>
          {imageUrl && (
            <Button type="button" variant="ghost" onClick={() => setImageUrl("")}>
              Remove
            </Button>
          )}
        </div>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create package"}
        </Button>
      </div>
    </FormShell>
  );
}
