import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Button, FormShell, Select } from "@/components/ui-kit";
import { formatMoney, formatDate, shortId } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronLeft, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SkeletonTable } from "@/components/skeleton";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Klientet — trans.square.al" },
      { name: "description", content: "Menaxhoni informacionin e klienteve dhe shikoni historikun e shpenzimeve." },
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
  const { t } = useTranslation();

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
    if (!confirm(t("clients.deleteConfirm"))) return;
    try {
      await api.clients.delete(id);
      toast.success(t("clients.clientDeleted"));
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
        title={t("clients.title")}
        description={t("clients.description")}
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> {t("clients.newClient")}
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("clients.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {busy ? (
          <SkeletonTable rows={5} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("clients.noClientsYet")}
            description={t("clients.noClientsDescription")}
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> {t("clients.newClient")}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[700px]">
              <thead className="bg-secondary/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("common.name")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("common.phone")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("common.idNumber")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("overview.packages")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("clients.totalSpent")}</th>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("clients.editClient") : t("clients.newClientTitle")}>
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

/* --- Client form --- */

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
  const { t } = useTranslation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("clients.nameRequired"));
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
      toast.success(initial ? t("clients.clientUpdated") : t("clients.clientCreated"));
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label={t("clients.fullName")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.phone")}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-() ]/g, ""))} placeholder="+355 69..." />
        </Field>
        <Field label={t("common.email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
        </Field>
      </div>
      <Field label={t("common.idNumber")} hint={t("clients.idNumberHint")}>
        <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="A12345678" />
      </Field>
      <Field label={t("common.address")}>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rruga, Qyteti, Vendi" />
      </Field>
      <Field label={t("common.notes")}>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informacion shtese..." />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : initial ? t("common.saveChanges") : t("clients.createClient")}
        </Button>
      </div>
    </FormShell>
  );
}

/* --- Client detail view --- */

function ClientDetail({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [client, setClient] = useState<any>(null);
  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [busy, setBusy] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        <PageHeader title={t("clients.title")} />
        <PageBody>
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
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
        description={t("clients.detailDescription")}
        actions={
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> {t("clients.backToClients")}
          </Button>
        }
      />
      <PageBody>
        {/* Info cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label={t("common.phone")} value={client.phone || "—"} />
          <InfoCard label={t("common.email")} value={client.email || "—"} />
          <InfoCard label={t("common.idNumber")} value={client.id_number || "—"} mono />
          <InfoCard label={t("common.address")} value={client.address || "—"} />
        </div>

        {client.notes && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.notes")}</div>
            <div className="mt-1 text-sm">{client.notes}</div>
          </div>
        )}

        {/* Spending summary */}
        <div className="mt-3 rounded-lg border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("clients.totalSpending")}</div>
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
            {t("clients.packagesTotal", { count: packages.length })}
          </div>
        </div>

        {/* Package history table */}
        <div className="mt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("clients.packageHistory")}
          </div>
          {packages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              {t("clients.noPackagesFound")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[600px]">
                <thead className="bg-secondary/50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("cargoDetail.package")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cargoDetail.product")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("package.cargo")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("common.price")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("package.payment")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("common.date")}</th>
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
                          {{ paid: t("clients.paid"), on_delivery: t("clients.onDelivery"), partly: t("clients.partly") }[p.payment_status] ?? p.payment_status}
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
