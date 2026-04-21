-- Add payment status to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid';

-- Add client information to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS client_id_number text;

-- Add partly payment fields
ALTER TABLE packages ADD COLUMN IF NOT EXISTS amount_paid numeric;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS amount_remaining numeric;
