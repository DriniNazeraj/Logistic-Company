import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Modal, Field, Input, Button, FormShell } from "@/components/ui-kit";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/warehouse")({
  head: () => ({
    meta: [
      { title: "Warehouses — trans.al" },
      { name: "description", content: "Visually design warehouse layouts and sections." },
    ],
  }),
  component: WarehousesPage,
});

interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  canvas_width: number;
  canvas_height: number;
}

function WarehousesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Warehouse[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    const { data: ws } = await supabase
      .from("warehouses")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(ws ?? []);
    const { data: ss } = await supabase.from("sections").select("warehouse_id");
    const c: Record<string, number> = {};
    ss?.forEach((s) => {
      c[s.warehouse_id] = (c[s.warehouse_id] ?? 0) + 1;
    });
    setCounts(c);
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete warehouse and all its sections?")) return;
    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Warehouse deleted");
    load();
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Manage warehouses and design their physical layout."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New warehouse
          </Button>
        }
      />
      <PageBody>
        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No warehouses yet"
            description="Create your first warehouse to start designing its layout."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New warehouse
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((w) => (
              <div
                key={w.id}
                className="group flex flex-col rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                    <WarehouseIcon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(w);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" onClick={() => remove(w.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-3 text-base font-semibold">{w.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {w.location || "No location"}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-3 font-mono text-xs text-muted-foreground">
                    {counts[w.id] ?? 0} section{counts[w.id] === 1 ? "" : "s"} ·{" "}
                    {w.canvas_width}×{w.canvas_height}
                  </div>
                  <Link
                    to="/warehouse/$id"
                    params={{ id: w.id }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Open layout editor
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit warehouse" : "New warehouse"}
      >
        <WarehouseForm
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

function WarehouseForm({
  initial,
  onSaved,
}: {
  initial: Warehouse | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [w, setW] = useState(initial?.canvas_width ?? 1000);
  const [h, setH] = useState(initial?.canvas_height ?? 600);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { name, location: location || null, canvas_width: w, canvas_height: h };
    const { error } = initial
      ? await supabase.from("warehouses").update(payload).eq("id", initial.id)
      : await supabase.from("warehouses").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Warehouse updated" : "Warehouse created");
    onSaved();
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tirana Main" />
      </Field>
      <Field label="Location">
        <Input
          value={location ?? ""}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Tirana, Albania"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Canvas width" hint="Total layout width in px.">
          <Input type="number" value={w} onChange={(e) => setW(Number(e.target.value))} min={400} />
        </Field>
        <Field label="Canvas height">
          <Input type="number" value={h} onChange={(e) => setH(Number(e.target.value))} min={300} />
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create warehouse"}
        </Button>
      </div>
    </FormShell>
  );
}
