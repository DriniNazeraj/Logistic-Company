import { Input, Select } from "@/components/ui-kit";
import { CURRENCIES, Currency } from "@/lib/format";

export function MoneyInput({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  placeholder = "0.00",
}: {
  amount: string;
  currency: Currency | string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: Currency) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        className="w-[112px]"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </Select>
    </div>
  );
}
