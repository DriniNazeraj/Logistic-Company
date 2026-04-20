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
  const formatted = new Intl.NumberFormat("en-US", {
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
    return new Date(d).toLocaleDateString("en-GB", {
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

/** Approximate exchange rates to EUR (base). */
const TO_EUR: Record<Currency, number> = {
  EUR: 1,
  USD: 0.92,
  ALL: 0.0093,
};

const FROM_EUR: Record<Currency, number> = {
  EUR: 1,
  USD: 1.09,
  ALL: 107.5,
};

/** Country → default currency mapping. */
const COUNTRY_CURRENCY: Record<string, Currency> = {
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
  const inEur = amount * TO_EUR[from];
  return inEur * FROM_EUR[to];
}

/** Convert a totals map { EUR: 100, USD: 50 } into a single amount in the target currency. */
export function convertTotals(totals: Record<string, number>, targetCurrency: Currency): number {
  let sum = 0;
  for (const [cur, amt] of Object.entries(totals)) {
    sum += convertCurrency(amt, (cur as Currency) || "EUR", targetCurrency);
  }
  return sum;
}
