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
    <div className="flex gap-1">
      <Input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-[3]"
      />
      <Select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        className="flex-[1] min-w-[48px] max-w-[56px]"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag}
          </option>
        ))}
      </Select>
    </div>
  );
}
