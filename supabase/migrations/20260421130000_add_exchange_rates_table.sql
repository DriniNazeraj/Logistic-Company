-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency)
);

-- Seed default rates
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
  ('USD', 'EUR', 0.92),
  ('EUR', 'USD', 1.09),
  ('ALL', 'EUR', 0.0093),
  ('EUR', 'ALL', 107.5),
  ('USD', 'ALL', 98.9),
  ('ALL', 'USD', 0.0101)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and update
CREATE POLICY "Authenticated users can read exchange rates"
  ON exchange_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert exchange rates"
  ON exchange_rates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update exchange rates"
  ON exchange_rates FOR UPDATE TO authenticated USING (true);
