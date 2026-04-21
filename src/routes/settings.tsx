import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { Field, Input, Button } from "@/components/ui-kit";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — trans.al" },
      { name: "description", content: "Manage exchange rates and app settings." },
    ],
  }),
  component: SettingsPage,
});

interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
}

const PAIRS = [
  { from: "USD", to: "EUR", label: "USD → EUR" },
  { from: "EUR", to: "USD", label: "EUR → USD" },
  { from: "ALL", to: "EUR", label: "ALL → EUR" },
  { from: "EUR", to: "ALL", label: "EUR → ALL" },
  { from: "USD", to: "ALL", label: "USD → ALL" },
  { from: "ALL", to: "USD", label: "ALL → USD" },
];

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const data: ExchangeRate[] = await api.settings.getExchangeRates();
      const map: Record<string, string> = {};
      data.forEach((r) => {
        map[`${r.from_currency}_${r.to_currency}`] = String(r.rate);
      });
      // Fill defaults for any missing pairs
      const defaults: Record<string, number> = {
        USD_EUR: 0.92,
        EUR_USD: 1.09,
        ALL_EUR: 0.0093,
        EUR_ALL: 107.5,
        USD_ALL: 98.9,
        ALL_USD: 0.0101,
      };
      for (const pair of PAIRS) {
        const key = `${pair.from}_${pair.to}`;
        if (!map[key]) map[key] = String(defaults[key] ?? 1);
      }
      setRates(map);
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = PAIRS.map((pair) => ({
        from_currency: pair.from,
        to_currency: pair.to,
        rate: Number(rates[`${pair.from}_${pair.to}`]) || 0,
      }));
      await api.settings.saveExchangeRates(payload);
      toast.success("Exchange rates saved");
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage currency exchange rates."
      />
      <PageBody>
        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <div className="max-w-lg space-y-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Exchange Rates</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Set the conversion rates between currencies. These are used to calculate cargo totals.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {PAIRS.map((pair) => {
                  const key = `${pair.from}_${pair.to}`;
                  return (
                    <Field key={key} label={pair.label}>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rates[key] ?? ""}
                        onChange={(e) =>
                          setRates((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </Field>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={save} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save rates"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
