import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, StatusBadge } from "@/components/layout-primitives";
import { Button } from "@/components/ui-kit";
import { shortId } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { autoTransitPendingCargos } from "@/lib/auto-transit";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Kalendari — trans.square.al" },
      { name: "description", content: "Pamja e kalendarit te nisjeve dhe mberritjeve te ngarkesave." },
    ],
  }),
  component: CalendarPage,
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

type EventType = "departure" | "arrival";

interface CargoEvent {
  cargo: Cargo;
  type: EventType;
  date: string; // YYYY-MM-DD
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns 0=Mon … 6=Sun for the first day of the month */
function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;
}

function toDateKey(d: string): string {
  // Normalize to YYYY-MM-DD
  return d.slice(0, 10);
}

function CalendarPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [busy, setBusy] = useState(true);
  const { t } = useTranslation();

  const WEEKDAYS = t("calendar.weekdays", { returnObjects: true }) as string[];

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      await autoTransitPendingCargos();
      try {
        const cs = await api.cargos.list();
        setCargos(cs);
      } catch (err: any) {
        toast.error(err.message);
      }
      setBusy(false);
    })();
  }, [user]);

  // Build events map: date -> CargoEvent[]
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CargoEvent[]>();
    const add = (cargo: Cargo, type: EventType, date: string | null) => {
      if (!date) return;
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push({ cargo, type, date: key });
      map.set(key, list);
    };
    for (const c of cargos) {
      add(c, "departure", c.departure_date);
      add(c, "arrival", c.arrival_date);
    }
    return map;
  }, [cargos]);

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthLabel = new Date(year, month).toLocaleString("sq-AL", { month: "long", year: "numeric" });
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build grid cells (6 rows max)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const handleCargoClick = (cargoId: string) => {
    navigate({ to: "/package", search: { cargo: cargoId } });
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title={t("calendar.title")} description={t("calendar.description")} />
      <PageBody>
        {/* Month navigation */}
        <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[140px] text-center text-sm font-semibold sm:min-w-[180px]">{monthLabel}</h2>
            <Button variant="ghost" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={goToday} className="ml-1 text-xs">
              {t("common.today")}
            </Button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground sm:ml-auto">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              {t("calendar.departure")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t("calendar.arrival")}
            </span>
          </div>
        </div>

        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <div className="min-w-[500px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border bg-secondary/50">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:px-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border bg-secondary/20 last:border-r-0" />;
                }
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const events = eventsByDate.get(dateKey) ?? [];
                const isToday = dateKey === todayKey;

                return (
                  <div
                    key={dateKey}
                    className={
                      "min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 " +
                      (isToday ? "bg-accent/10" : "")
                    }
                  >
                    <div className={
                      "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                      (isToday ? "bg-foreground text-background" : "text-muted-foreground")
                    }>
                      {day}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {events.slice(0, 3).map((ev) => (
                        <button
                          key={`${ev.cargo.id}-${ev.type}`}
                          onClick={() => handleCargoClick(ev.cargo.id)}
                          className={
                            "group flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors " +
                            (ev.type === "departure"
                              ? "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400"
                              : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400")
                          }
                          title={`${ev.type === "departure" ? t("calendar.departs") : t("calendar.arrives")}: ${ev.cargo.cargo_code || shortId(ev.cargo.id)} — ${ev.cargo.departure_country} → ${ev.cargo.destination_country}\n${t("calendar.clickToView")}`}
                        >
                          <span className={
                            "h-1.5 w-1.5 shrink-0 rounded-full " +
                            (ev.type === "departure" ? "bg-blue-500" : "bg-emerald-500")
                          } />
                          <span className="truncate">
                            {ev.cargo.cargo_code || shortId(ev.cargo.id)}
                          </span>
                        </button>
                      ))}
                      {events.length > 3 && (
                        <span className="px-1.5 text-[10px] text-muted-foreground">
                          {t("calendar.more", { count: events.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
