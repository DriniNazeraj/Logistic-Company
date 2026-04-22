import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PageBody } from "@/components/layout-primitives";
import { Field, Input, Select, Button } from "@/components/ui-kit";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { Currency } from "@/lib/format";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Cilesimet — trans.al" },
      { name: "description", content: "Menaxhoni kurset e kembimit dhe cilesimet e aplikacionit." },
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
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>(
    () => (localStorage.getItem("overview_currency") as Currency) || "USD",
  );
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

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
      toast.success(t("settings.ratesSaved"));
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <PageBody>
        {busy ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <div className="max-w-lg space-y-6">
            {/* Language */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{t("settings.language")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("settings.languageDescription")}
              </p>
              <div className="mt-4 max-w-[200px]">
                <Field label={t("settings.languageLabel")}>
                  <Select
                    value={i18n.language}
                    onChange={(e) => {
                      const lang = e.target.value;
                      i18n.changeLanguage(lang);
                      localStorage.setItem("app_language", lang);
                      document.documentElement.lang = lang;
                      toast.success(t("settings.languageChanged", { language: lang === "en" ? "English" : "Shqip" }));
                    }}
                  >
                    <option value="en">{t("settings.languageEN")}</option>
                    <option value="sq">{t("settings.languageSQ")}</option>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Default overview currency */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{t("settings.overviewCurrency")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("settings.overviewCurrencyDescription")}
              </p>
              <div className="mt-4 max-w-[200px]">
                <Field label={t("settings.defaultCurrency")}>
                  <Select
                    value={defaultCurrency}
                    onChange={(e) => {
                      const val = e.target.value as Currency;
                      setDefaultCurrency(val);
                      localStorage.setItem("overview_currency", val);
                      toast.success(t("settings.currencySetTo", { currency: val }));
                    }}
                  >
                    <option value="USD">{t("settings.currencyUSD")}</option>
                    <option value="EUR">{t("settings.currencyEUR")}</option>
                    <option value="ALL">{t("settings.currencyALL")}</option>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{t("settings.exchangeRates")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("settings.exchangeRatesDescription")}
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
                  {saving ? t("common.saving") : t("settings.saveRates")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
