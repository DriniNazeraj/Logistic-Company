import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody, EmptyState } from "@/components/layout-primitives";
import { Input, Select } from "@/components/ui-kit";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SkeletonTable } from "@/components/skeleton";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historiku — trans.square.al" },
      { name: "description", content: "Historiku i skanimeve te paketave." },
    ],
  }),
  component: HistoryPage,
});

interface ScanLog {
  id: string;
  client_name: string | null;
  client_id_number: string | null;
  package_code: string;
  scanned_code: string;
  result: string;
  created_at: string;
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const res = await api.history.list({
        limit: 200,
        search: search || undefined,
        result: resultFilter !== "all" ? resultFilter : undefined,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user, search, resultFilter]);

  if (!user) return null;

  const resultColor: Record<string, string> = {
    success: "bg-green-500/15 text-green-500 border-green-500/30",
    mismatch: "bg-red-500/15 text-red-500 border-red-500/30",
  };

  return (
    <>
      <PageHeader
        title={t("history.title")}
        description={t("history.description")}
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-[2] sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("history.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-28 shrink-0 sm:w-auto sm:max-w-xs"
          >
            <option value="all">{t("history.allResults")}</option>
            <option value="success">{t("history.success")}</option>
            <option value="mismatch">{t("history.mismatch")}</option>
          </Select>
        </div>

        {busy ? (
          <SkeletonTable rows={8} cols={6} />
        ) : logs.length === 0 ? (
          <EmptyState
            title={t("history.noHistory")}
            description={t("history.noHistoryDescription")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[700px]">
              <thead className="bg-secondary/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("history.clientName")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("history.clientId")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("history.packageCode")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("history.result")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("history.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{log.client_name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.client_id_number || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.package_code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          (resultColor[log.result] ?? "bg-muted text-muted-foreground border-border")
                        }
                      >
                        {log.result === "success" ? t("history.success") : t("history.mismatch")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("sq-AL", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}
