import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Button, FormShell, Select } from "@/components/ui-kit";
import { formatMoney, formatDate, shortId } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronLeft, Eye } from "lucide-react";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — trans.al" },
      { name: "description", content: "Manage client information and view spending history." },
    ],
  }),
  component: ClientsPage,
});

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  address: string | null;
  notes: string | null;
  total_packages: number;
  total_spent_eur: number;
  total_spent_usd: number;
  total_spent_all: number;
  created_at: string;
}

interface ClientPackage {
  id: string;
  package_code: string;
  product_name: string;
  price: number;
  currency: string;
  payment_status: string;
  cargo_code: string | null;
  created_at: string;
}

function ClientsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const cs = await api.clients.list();
      setClients(cs);
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
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.phone?.toLowerCase().includes(q)) ||
        (c.id_number?.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (c: Client) => {
    setEditing(c);
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    try {
      await api.clients.delete(id);
      toast.success("Client deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!user) return null;

  // If viewing a specific client, show detail view
  if (viewing) {
    return (
      <ClientDetail
        clientId={viewing}
        onBack={() => { setViewing(null); load(); }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Client directory and spending history."
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> New client
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, ID…"
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
            title="No clients yet"
            description="Add your first client to start tracking their packages and spending."
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> New client
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[700px]">
              <thead className="bg-secondary/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">ID Number</th>
                  <th className="px-4 py-2.5 font-medium">Packages</th>
                  <th className="px-4 py-2.5 font-medium">Total Spent</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => setViewing(c.id)}
                  >
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.id_number || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.total_packages}</td>
                    <td className="px-4 py-3">
                      <SpendingSummary eur={c.total_spent_eur} usd={c.total_spent_usd} all={c.total_spent_all} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" onClick={() => setViewing(c.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit client" : "New client"}>
        <ClientForm
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

function SpendingSummary({ eur, usd, all }: { eur: number; usd: number; all: number }) {
  const parts: string[] = [];
  if (Number(usd) > 0) parts.push(formatMoney(usd, "USD"));
  if (Number(eur) > 0) parts.push(formatMoney(eur, "EUR"));
  if (Number(all) > 0) parts.push(formatMoney(all, "ALL"));
  if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono text-xs">{parts.join(" · ")}</span>;
}

/* ─── Client form ─── */

function ClientForm({
  initial,
  onSaved,
}: {
  initial: Client | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [idNumber, setIdNumber] = useState(initial?.id_number ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    setBusy(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      id_number: idNumber.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (initial) {
        await api.clients.update(initial.id, payload);
      } else {
        await api.clients.create(payload);
      }
      toast.success(initial ? "Client updated" : "Client created");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label="Full name *">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+355 69…" />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
        </Field>
      </div>
      <Field label="ID number" hint="Unique identifier used to match packages to this client.">
        <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="A12345678" />
      </Field>
      <Field label="Address">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, Country" />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional info…" />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create client"}
        </Button>
      </div>
    </FormShell>
  );
}

/* ─── Client detail view ─── */

function ClientDetail({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [client, setClient] = useState<any>(null);
  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [busy, setBusy] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const data = await api.clients.get(clientId);
        setClient(data.client);
        setPackages(data.packages);
      } catch (err: any) {
        toast.error(err.message);
        onBack();
      }
      setBusy(false);
    })();
  }, [clientId]);

  if (busy || !client) {
    return (
      <>
        <PageHeader title="Client" />
        <PageBody>
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        </PageBody>
      </>
    );
  }

  const totals: Record<string, number> = {};
  packages.forEach((p) => {
    const cur = p.currency ?? "EUR";
    totals[cur] = (totals[cur] ?? 0) + Number(p.price ?? 0);
  });

  const paymentColor: Record<string, string> = {
    paid: "bg-success/15 text-success border-success/30",
    on_delivery: "bg-warning/15 text-warning border-warning/30",
    partly: "bg-accent/15 text-accent border-accent/30",
  };

  return (
    <>
      <PageHeader
        title={client.name}
        description="Client details and package history"
        actions={
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> Back to clients
          </Button>
        }
      />
      <PageBody>
        {/* Info cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Phone" value={client.phone || "—"} />
          <InfoCard label="Email" value={client.email || "—"} />
          <InfoCard label="ID Number" value={client.id_number || "—"} mono />
          <InfoCard label="Address" value={client.address || "—"} />
        </div>

        {client.notes && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</div>
            <div className="mt-1 text-sm">{client.notes}</div>
          </div>
        )}

        {/* Spending summary */}
        <div className="mt-3 rounded-lg border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Spending</div>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {Object.keys(totals).length === 0 ? (
              <span className="font-mono text-2xl text-muted-foreground">—</span>
            ) : (
              ["USD", "EUR", "ALL"]
                .filter((c) => totals[c])
                .map((c) => (
                  <div key={c}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c}</div>
                    <div className="font-mono text-2xl font-semibold tracking-tight">
                      {formatMoney(totals[c], c)}
                    </div>
                  </div>
                ))
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {packages.length} package{packages.length !== 1 ? "s" : ""} total
          </div>
        </div>

        {/* Package history table */}
        <div className="mt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Package History
          </div>
          {packages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No packages found for this client.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[600px]">
                <thead className="bg-secondary/50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Package</th>
                    <th className="px-4 py-2.5 font-medium">Product</th>
                    <th className="px-4 py-2.5 font-medium">Cargo</th>
                    <th className="px-4 py-2.5 font-medium">Price</th>
                    <th className="px-4 py-2.5 font-medium">Payment</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {packages.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-mono text-xs">{p.package_code || shortId(p.id)}</td>
                      <td className="px-4 py-3">{p.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.cargo_code || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{formatMoney(p.price, p.currency)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            (paymentColor[p.payment_status] ?? "bg-muted text-muted-foreground border-border")
                          }
                        >
                          {{ paid: "Paid", on_delivery: "On delivery", partly: "Partly" }[p.payment_status] ?? p.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-1 truncate text-sm " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}
