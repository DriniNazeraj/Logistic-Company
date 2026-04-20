
ALTER TABLE public.cargos ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.cargos ADD CONSTRAINT cargos_currency_check CHECK (currency IN ('EUR','USD','ALL'));
ALTER TABLE public.packages ADD CONSTRAINT packages_currency_check CHECK (currency IN ('EUR','USD','ALL'));
