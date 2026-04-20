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
