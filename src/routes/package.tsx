import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Select, Button, FormShell } from "@/components/ui-kit";
import { MoneyInput } from "@/components/money-input";
import { formatMoney, formatDate, shortId, Currency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package as PackageIcon, Upload } from "lucide-react";

export const Route = createFileRoute("/package")({
  head: () => ({
    meta: [
      { title: "Packages — trans.al" },
      { name: "description", content: "Manage individual packages and assign them to cargos." },
    ],
  }),
  component: PackagesPage,
});

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
  cargo_id: string | null;
  section_id: string | null;
}

interface CargoOpt {
  id: string;
  cargo_code: string;
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
  const [query, setQuery] = useState("");
  const [cargoFilter, setCargoFilter] = useState("all");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    const [{ data: ps }, { data: cs }, { data: ws }, { data: ss }] = await Promise.all([
      supabase.from("packages").select("*").order("created_at", { ascending: false }),
      supabase.from("cargos").select("id, cargo_code").order("created_at", { ascending: false }),
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
    </>
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
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? "EUR");
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
      <Field label="Related cargo">
        <Select value={cargoId ?? ""} onChange={(e) => setCargoId(e.target.value)}>
          <option value="">Unassigned</option>
          {cargos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cargo_code}
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
