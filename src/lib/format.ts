export type Currency = "EUR" | "USD" | "ALL";

export const CURRENCIES: { code: Currency; label: string; symbol: string; flag: string }[] = [
  { code: "EUR", label: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "USD", label: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "ALL", label: "Albanian Lek", symbol: "L", flag: "🇦🇱" },
];

export function currencyInfo(code: string | null | undefined) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
) {
  const v = Number(amount ?? 0);
  const info = currencyInfo(currency);
  const formatted = new Intl.NumberFormat("sq-AL", {
    maximumFractionDigits: info.code === "ALL" ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(v);
  // Lek goes after the amount, symbols for EUR/USD before
  if (info.code === "ALL") return `${formatted} L`;
  return `${info.symbol}${formatted}`;
}

/** @deprecated use formatMoney(amount, currency) */
export function formatCurrency(n: number | null | undefined) {
  return formatMoney(n, "EUR");
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("sq-AL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function statusLabel(s: string) {
  return (
    {
      pending: "Pending",
      in_transit: "In transit",
      delivered: "Delivered",
    }[s] ?? s
  );
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

/** Default exchange rates (used as fallback before DB rates load). */
const DEFAULT_RATES: Record<string, number> = {
  USD_EUR: 0.92,
  EUR_USD: 1.09,
  ALL_EUR: 0.0093,
  EUR_ALL: 107.5,
  USD_ALL: 98.9,
  ALL_USD: 0.0101,
};

/** Mutable rate store — updated by loadExchangeRates(). */
let rateStore: Record<string, number> = { ...DEFAULT_RATES };

export type ExchangeRates = Record<string, number>;

/** Load rates from the API and cache in memory. Call once on pages that need conversion. */
export async function loadExchangeRates(): Promise<ExchangeRates> {
  try {
    const { api } = await import("@/lib/api");
    const data: { from_currency: string; to_currency: string; rate: number }[] =
      await api.settings.getExchangeRates();
    if (data && data.length > 0) {
      const map: Record<string, number> = { ...DEFAULT_RATES };
      data.forEach((r) => {
        map[`${r.from_currency}_${r.to_currency}`] = r.rate;
      });
      rateStore = map;
    }
  } catch {
    // Use defaults if API is unavailable
  }
  return rateStore;
}

/** Get the current rate for a pair. */
function getRate(from: Currency, to: Currency): number {
  return rateStore[`${from}_${to}`] ?? DEFAULT_RATES[`${from}_${to}`] ?? 1;
}

/** Country → default currency mapping. */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  USA: "USD",
  Albania: "ALL",
  Kosovo: "EUR",
  Italy: "EUR",
  Germany: "EUR",
  Greece: "EUR",
  France: "EUR",
  Turkey: "USD",
  UK: "USD",
};

export function currencyForCountry(country: string): Currency {
  return COUNTRY_CURRENCY[country] ?? "EUR";
}

/** Convert an amount from one currency to another. */
export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  return amount * getRate(from, to);
}

/** Convert a totals map { EUR: 100, USD: 50 } into a single amount in the target currency. */
export function convertTotals(totals: Record<string, number>, targetCurrency: Currency): number {
  let sum = 0;
  for (const [cur, amt] of Object.entries(totals)) {
    sum += convertCurrency(amt, (cur as Currency) || "EUR", targetCurrency);
  }
  return sum;
}
