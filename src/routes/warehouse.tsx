import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, MouseEvent as RMouseEvent, FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { Modal, Field, Input, Select, Button, FormShell } from "@/components/ui-kit";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  X,
  Search,
  Package as PackageIcon,
  Settings,
  Warehouse as WarehouseIcon,
  GripVertical,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/warehouse")({
  head: () => ({
    meta: [
      { title: "Magazinat — trans.square.al" },
      { name: "description", content: "Menaxhoni hapesirat e magazines dhe seksionet." },
    ],
  }),
  component: WarehousePage,
});

interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  canvas_width: number;
  canvas_height: number;
}

interface Section {
  id: string;
  warehouse_id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Pkg {
  id: string;
  package_code: string;
  product_name: string;
  section_id: string | null;
}

const COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#84cc16"];

type DragState =
  | { kind: "none" }
  | { kind: "move"; id: string; offX: number; offY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; startW: number; startH: number };

function WarehousePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  const [busy, setBusy] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async (selectId?: string) => {
    setBusy(true);

    const list: Warehouse[] = await api.warehouses.list() ?? [];

    // Auto-create one if none exists
    if (list.length === 0) {
      try {
        const created = await api.warehouses.create({ name: "Magazine Kryesore", location: null, canvas_width: 1000, canvas_height: 600 });
        list.push(created as Warehouse);
      } catch (err: any) {
        toast.error(err.message);
        setBusy(false);
        return;
      }
    }

    setAllWarehouses(list);

    // Pick which warehouse to show
    const w = (selectId ? list.find((x) => x.id === selectId) : null) ?? list[0];

    const [ss, ps] = await Promise.all([
      api.sections.list(w.id),
      api.packages.list(),
    ]);

    setWarehouse(w);
    setSections(ss ?? []);
    setPackages((ps ?? []).map((p: any) => ({ id: p.id, package_code: p.package_code, product_name: p.product_name, section_id: p.section_id })));
    setSelected(null);
    setBusy(false);
  };

  const switchWarehouse = async (id: string) => {
    if (id === warehouse?.id) return;
    await load(id);
  };

  const addWarehouse = () => setNewOpen(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const sel = sections.find((s) => s.id === selected) ?? null;
  const unassigned = packages.filter((p) => !p.section_id);

  /* -- Package assignment -- */
  const assignPackage = async (pkgId: string, sectionId: string | null) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, section_id: sectionId } : p)),
    );
    try {
      await api.packages.update(pkgId, { section_id: sectionId });
    } catch (err: any) {
      toast.error(err.message);
      load();
    }
  };

  /* -- Section CRUD -- */
  const addSection = async () => {
    if (!warehouse) return;
    const color = COLORS[sections.length % COLORS.length];
    const payload = {
      warehouse_id: warehouse.id,
      name: `Seksioni ${String.fromCharCode(65 + sections.length)}`,
      color,
      x: 24,
      y: 24,
      width: 160,
      height: 100,
    };
    try {
      const data = await api.sections.create(payload);
      setSections((prev) => [...prev, data as Section]);
      setSelected((data as Section).id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateSection = (s: Section, patch: Partial<Section>) => {
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  };

  const persistSection = async (s: Section) => {
    try {
      await api.sections.update(s.id, {
        name: s.name,
        color: s.color,
        x: Math.round(s.x),
        y: Math.round(s.y),
        width: Math.round(s.width),
        height: Math.round(s.height),
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm(t("warehouse.deleteSectionConfirm"))) return;
    try {
      await api.sections.delete(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setSelected(null);
      toast.success(t("warehouse.sectionDeleted"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  /* -- Drag / resize -- */
  const onCanvasMouseMove = (e: RMouseEvent) => {
    if (drag.kind === "none" || !canvasRef.current || !warehouse) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (drag.kind === "move") {
      const s = sections.find((x) => x.id === drag.id);
      if (!s) return;
      const nx = Math.max(0, Math.min(warehouse.canvas_width - s.width, px - drag.offX));
      const ny = Math.max(0, Math.min(warehouse.canvas_height - s.height, py - drag.offY));
      updateSection(s, { x: nx, y: ny });
    } else if (drag.kind === "resize") {
      const s = sections.find((x) => x.id === drag.id);
      if (!s) return;
      const nw = Math.max(60, Math.min(warehouse.canvas_width - s.x, drag.startW + (px - drag.startX)));
      const nh = Math.max(40, Math.min(warehouse.canvas_height - s.y, drag.startH + (py - drag.startY)));
      updateSection(s, { width: nw, height: nh });
    }
  };

  const onCanvasMouseUp = async () => {
    if (drag.kind === "none") return;
    const s = sections.find((x) => x.id === drag.id);
    setDrag({ kind: "none" });
    if (s) await persistSection(s);
  };

  /* -- Render -- */
  if (!user) return null;

  if (busy || !warehouse) {
    return (
      <>
        <PageHeader title={t("warehouse.title")} />
        <PageBody>
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("warehouse.title")}
        description={t("warehouse.description")}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={warehouse.id}
              onChange={(e) => switchWarehouse(e.target.value)}
              className="max-w-[200px]"
            >
              {allWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={addWarehouse}>
              <Plus className="h-3.5 w-3.5" /> {t("warehouse.newWarehouse")}
            </Button>
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          {/* -- Canvas -- */}
          <div className="min-w-0 rounded-lg border border-border bg-card p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative max-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("warehouse.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    if (!q.trim()) {
                      setHighlightSectionId(null);
                      return;
                    }
                    const found = packages.find((p) =>
                      p.package_code.toLowerCase().includes(q.toLowerCase().trim()),
                    );
                    if (found?.section_id) {
                      setHighlightSectionId(found.section_id);
                      setSelected(found.section_id);
                    } else {
                      setHighlightSectionId(null);
                    }
                  }}
                  className="pl-8"
                />
              </div>
              <div className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {warehouse.canvas_width} x {warehouse.canvas_height} &middot;{" "}
                {sections.length} {sections.length === 1 ? t("warehouse.sectionCountOne", { count: sections.length }) : t("warehouse.sectionCount", { count: sections.length })}
              </div>
              <div className="ml-auto">
                <Button onClick={addSection}>
                  <Plus className="h-3.5 w-3.5" /> {t("warehouse.addSection")}
                </Button>
              </div>
            </div>
            <div className="overflow-auto rounded-md border border-border bg-background">
              <div
                ref={canvasRef}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                onClick={(e) => {
                  if (e.target === canvasRef.current) setSelected(null);
                }}
                className="grid-bg relative"
                style={{
                  width: warehouse.canvas_width,
                  height: warehouse.canvas_height,
                  minWidth: "100%",
                }}
              >
                {sections.map((s) => {
                  const active = s.id === selected;
                  const highlighted = s.id === highlightSectionId;
                  const pkgsHere = packages.filter((p) => p.section_id === s.id).length;
                  return (
                    <div
                      key={s.id}
                      onMouseDown={(e) => {
                        if (!canvasRef.current) return;
                        const rect = canvasRef.current.getBoundingClientRect();
                        setSelected(s.id);
                        setDrag({
                          kind: "move",
                          id: s.id,
                          offX: e.clientX - rect.left - s.x,
                          offY: e.clientY - rect.top - s.y,
                        });
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const pkgId = e.dataTransfer.getData("application/x-package-id");
                        if (pkgId) assignPackage(pkgId, s.id);
                      }}
                      className={
                        "absolute cursor-move select-none rounded-md border-2 transition-shadow " +
                        (highlighted ? "shadow-lg ring-2 ring-accent animate-pulse" : "") +
                        (active && !highlighted ? " shadow-lg ring-2 ring-ring/60" : "")
                      }
                      style={{
                        left: s.x,
                        top: s.y,
                        width: s.width,
                        height: s.height,
                        backgroundColor: s.color + "33",
                        borderColor: s.color,
                      }}
                    >
                      <div className="flex h-full flex-col p-2">
                        <div className="text-xs font-semibold" style={{ color: s.color }}>
                          {s.name}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {Math.round(s.width)}x{Math.round(s.height)}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                            <PackageIcon className="h-3 w-3" />
                            {pkgsHere}
                          </div>
                        </div>
                      </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!canvasRef.current) return;
                          const rect = canvasRef.current.getBoundingClientRect();
                          setSelected(s.id);
                          setDrag({
                            kind: "resize",
                            id: s.id,
                            startX: e.clientX - rect.left,
                            startY: e.clientY - rect.top,
                            startW: s.width,
                            startH: s.height,
                          });
                        }}
                        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm"
                        style={{ backgroundColor: s.color }}
                      />
                    </div>
                  );
                })}
                {sections.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <WarehouseIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm text-muted-foreground">{t("warehouse.noSections")}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {t("warehouse.addSectionHint")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* -- Side panel -- */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {sel ? t("warehouse.sectionProperties") : t("warehouse.selectSection")}
              </div>
              {sel ? (
                <div className="mt-3 space-y-3">
                  <Field label={t("common.name")}>
                    <Input
                      value={sel.name}
                      onChange={(e) => updateSection(sel, { name: e.target.value })}
                      onBlur={() => persistSection(sel)}
                    />
                  </Field>
                  <Field label={t("warehouse.color")}>
                    <div className="grid grid-cols-8 gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={async () => {
                            updateSection(sel, { color: c });
                            await persistSection({ ...sel, color: c });
                          }}
                          className={
                            "h-6 w-6 rounded-md border-2 " +
                            (sel.color === c ? "border-foreground" : "border-transparent")
                          }
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t("warehouse.width")}>
                      <Input
                        type="number"
                        value={Math.round(sel.width)}
                        onChange={(e) =>
                          updateSection(sel, { width: Number(e.target.value) || 60 })
                        }
                        onBlur={() => persistSection(sel)}
                      />
                    </Field>
                    <Field label={t("warehouse.height")}>
                      <Input
                        type="number"
                        value={Math.round(sel.height)}
                        onChange={(e) =>
                          updateSection(sel, { height: Number(e.target.value) || 40 })
                        }
                        onBlur={() => persistSection(sel)}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => deleteSection(sel.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t("warehouse.deleteSection")}
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("warehouse.selectSectionHint")}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("warehouse.packagesInSection")}
              </div>
              {sel ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {packages.filter((p) => p.section_id === sel.id).length === 0 ? (
                    <li className="text-xs text-muted-foreground">
                      {t("warehouse.dropPackagesHere")}
                    </li>
                  ) : (
                    packages
                      .filter((p) => p.section_id === sel.id)
                      .map((p) => (
                        <li
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-package-id", p.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50 cursor-grab" />
                            <span className="truncate">{p.product_name}</span>
                          </div>
                          <button
                            onClick={() => assignPackage(p.id, null)}
                            className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                            title={t("warehouse.removeFromSection")}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("warehouse.selectSectionForPackages")}
                </p>
              )}
            </div>

            <div
              className="rounded-lg border border-dashed border-border bg-card p-4"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const pkgId = e.dataTransfer.getData("application/x-package-id");
                if (pkgId) assignPackage(pkgId, null);
              }}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("warehouse.unassignedPackages", { count: unassigned.length })}
              </div>
              {unassigned.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("warehouse.allAssigned")}
                </p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                  {unassigned.map((p) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-package-id", p.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 active:cursor-grabbing"
                    >
                      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                      <span className="truncate">{p.product_name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                        {p.package_code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </PageBody>

      {/* -- Warehouse settings modal -- */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t("warehouse.warehouseSettings")}
      >
        <WarehouseSettingsForm
          warehouse={warehouse}
          canDelete={allWarehouses.length > 1}
          onSaved={(updated) => {
            setWarehouse(updated);
            setAllWarehouses((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
            setSettingsOpen(false);
          }}
          onDeleted={() => {
            setSettingsOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={t("warehouse.newWarehouseTitle")}
      >
        <NewWarehouseForm
          onCreated={(created) => {
            setNewOpen(false);
            load(created.id);
          }}
        />
      </Modal>
    </>
  );
}

function NewWarehouseForm({ onCreated }: { onCreated: (w: Warehouse) => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.warehouses.create({
        name: name.trim() || "Magazine e Re",
        location: location.trim() || undefined,
        canvas_width: 1000,
        canvas_height: 600,
      });
      toast.success(t("warehouse.warehouseCreated"));
      onCreated(created as Warehouse);
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label={t("common.name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("warehouse.warehouseNamePlaceholder")} />
      </Field>
      <Field label={t("warehouse.location")}>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Tirane, Shqiperi" />
      </Field>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("common.creating") : t("warehouse.createWarehouse")}
        </Button>
      </div>
    </FormShell>
  );
}

function WarehouseSettingsForm({
  warehouse,
  onSaved,
  onDeleted,
  canDelete,
}: {
  warehouse: Warehouse;
  onSaved: (w: Warehouse) => void;
  onDeleted: () => void;
  canDelete: boolean;
}) {
  const [name, setName] = useState(warehouse.name);
  const [location, setLocation] = useState(warehouse.location ?? "");
  const [w, setW] = useState(warehouse.canvas_width);
  const [h, setH] = useState(warehouse.canvas_height);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { name, location: location || undefined, canvas_width: w, canvas_height: h };
    try {
      await api.warehouses.update(warehouse.id, payload);
      toast.success(t("warehouse.warehouseUpdated"));
      onSaved({ ...warehouse, ...payload });
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <FormShell onSubmit={submit}>
      <Field label={t("common.name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Magazine Kryesore" />
      </Field>
      <Field label={t("warehouse.location")}>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Tirane, Shqiperi"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("warehouse.canvasWidth")} hint={t("warehouse.canvasWidthHint")}>
          <Input type="number" value={w} onChange={(e) => setW(Number(e.target.value))} min={400} />
        </Field>
        <Field label={t("warehouse.canvasHeight")}>
          <Input type="number" value={h} onChange={(e) => setH(Number(e.target.value))} min={300} />
        </Field>
      </div>
      <div className="flex items-center justify-between pt-2">
        {canDelete ? (
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (!confirm(t("warehouse.deleteWarehouseConfirm", { name: warehouse.name }))) return;
              try {
                await api.warehouses.delete(warehouse.id);
                toast.success(t("warehouse.warehouseDeleted"));
                onDeleted();
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </Button>
        ) : (
          <div />
        )}
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </FormShell>
  );
}
