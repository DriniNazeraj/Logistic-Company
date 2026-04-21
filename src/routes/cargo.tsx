import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, StatusBadge, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Select, Button, FormShell } from "@/components/ui-kit";
import { MoneyInput } from "@/components/money-input";
import { formatMoney, formatDate, shortId, Currency, currencyForCountry, convertTotals } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { autoTransitPendingCargos } from "@/lib/auto-transit";

export const Route = createFileRoute("/cargo")({
  head: () => ({
    meta: [
      { title: "Cargos — trans.al" },
      { name: "description", content: "Manage cargo shipments between countries." },
    ],
  }),
  component: CargosPage,
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

interface CargoWithTotals extends Cargo {
  package_count: number;
  totals: Record<string, number>;
}

const COUNTRIES = ["Albania", "Italy", "Germany", "Greece", "Turkey", "Kosovo", "France", "UK"];

function CargosPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cargos, setCargos] = useState<CargoWithTotals[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);

    await autoTransitPendingCargos();

    try {
      const [cs, ps] = await Promise.all([
        api.cargos.list(),
        api.packages.listSummary(),
      ]);
      const agg = new Map<string, { count: number; totals: Record<string, number> }>();
      ps.forEach((p: any) => {
        if (!p.cargo_id) return;
        const cur = agg.get(p.cargo_id) ?? { count: 0, totals: {} };
        cur.count += 1;
        const code = p.currency ?? "EUR";
        cur.totals[code] = (cur.totals[code] ?? 0) + Number(p.price ?? 0);
        agg.set(p.cargo_id, cur);
      });
      setCargos(
        cs.map((c: any) => ({
          ...c,
          package_count: agg.get(c.id)?.count ?? 0,
          totals: agg.get(c.id)?.totals ?? {},
        })),
      );
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return cargos;
    return cargos.filter(
      (c) =>
        c.cargo_code.toLowerCase().includes(q) ||
        c.departure_country.toLowerCase().includes(q) ||
        c.destination_country.toLowerCase().includes(q),
    );
  }, [cargos, query]);

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (c: Cargo) => {
    setEditing(c);
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this cargo? Packages will be unlinked.")) return;
    try {
      await api.cargos.delete(id);
      toast.success("Cargo deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Cargos"
        description="All shipments moving in and out of Albania."
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> New cargo
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search code or country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No cargos yet"
            description="Create your first cargo shipment to start tracking."
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> New cargo
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Route</th>
                  <th className="px-4 py-2.5 font-medium">Departure</th>
                  <th className="px-4 py-2.5 font-medium">Arrival</th>
                  <th className="px-4 py-2.5 font-medium">Packages</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => navigate({ to: "/package", search: { cargo: c.id } })}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.cargo_code || shortId(c.id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{c.departure_country}</span>
                      <span className="mx-1.5 text-muted-foreground/50">→</span>
                      <span>{c.destination_country}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.departure_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.arrival_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.package_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {Object.keys(c.totals).length === 0
                        ? "—"
                        : (() => {
                            const target = currencyForCountry(c.destination_country);
                            const total = convertTotals(c.totals, target);
                            return formatMoney(total, target);
                          })()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" onClick={() => startEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" onClick={() => remove(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit cargo" : "New cargo"}>
        <CargoForm
          initial={editing}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      </Modal>
    </>
  );
}

function CargoForm({
  initial,
  onSaved,
}: {
  initial: Cargo | null;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(initial?.cargo_code ?? "");
  const [from, setFrom] = useState(initial?.departure_country ?? "Albania");
  const [to, setTo] = useState(initial?.destination_country ?? "Italy");
  const [dep, setDep] = useState(initial?.departure_date ?? "");
  const [arr, setArr] = useState(initial?.arrival_date ?? "");
  const [status, setStatus] = useState(initial?.status ?? "pending");
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? "EUR");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!initial && dep && dep < today) {
      return toast.error("Departure date cannot be in the past.");
    }
    if (dep && arr && arr < dep) {
      return toast.error("Arrival date cannot be before the departure date.");
    }
    setBusy(true);
    const payload = {
      cargo_code: code || `CRG-${Date.now().toString(36).toUpperCase()}`,
      departure_country: from,
      destination_country: to,
      departure_date: dep || null,
      arrival_date: arr || null,
      status,
      currency,
    };
    try {
      if (initial) {
        await api.cargos.update(initial.id, payload);
      } else {
        await api.cargos.create(payload);
      }
      toast.success(initial ? "Cargo updated" : "Cargo created");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label="Cargo code" hint="Leave blank to auto-generate.">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CRG-001" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Departure country">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Destination country">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Departure date">
          <Input type="date" value={dep ?? ""} min={initial ? undefined : today} onChange={(e) => { setDep(e.target.value); if (arr && e.target.value && arr < e.target.value) setArr(""); }} />
        </Field>
        <Field label="Arrival date">
          <Input type="date" value={arr ?? ""} min={dep || undefined} onChange={(e) => setArr(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_transit">In transit</option>
            <option value="delivered">Delivered</option>
          </Select>
        </Field>
        <Field label="Default currency" hint="Used for cargo-level totals.">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="EUR">🇪🇺 Euro (EUR)</option>
            <option value="USD">🇺🇸 US Dollar (USD)</option>
            <option value="ALL">🇦🇱 Albanian Lek (ALL)</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create cargo"}
        </Button>
      </div>
    </FormShell>
  );
}
