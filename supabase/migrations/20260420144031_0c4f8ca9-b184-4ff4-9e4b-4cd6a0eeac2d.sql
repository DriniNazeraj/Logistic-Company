-- Cargos
CREATE TABLE public.cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo_code TEXT NOT NULL UNIQUE,
  departure_country TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  departure_date DATE,
  arrival_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Warehouses
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  canvas_width INTEGER NOT NULL DEFAULT 1000,
  canvas_height INTEGER NOT NULL DEFAULT 600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sections
CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 120,
  height INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Packages
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  destination_location TEXT,
  delivery_date DATE,
  arrival_date DATE,
  image_url TEXT,
  cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE packages ADD COLUMN payment_status text NOT NULL DEFAULT 'paid';

ALTER TABLE packages
    ADD COLUMN client_name text,
    ADD COLUMN client_phone text,
    ADD COLUMN client_email text,
    ADD COLUMN client_id_number text;

CREATE INDEX idx_packages_cargo ON public.packages(cargo_id);
CREATE INDEX idx_packages_section ON public.packages(section_id);
CREATE INDEX idx_sections_warehouse ON public.sections(warehouse_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_cargos_updated BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access (single-tenant manager app)
CREATE POLICY "auth read cargos" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cargos" ON public.cargos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cargos" ON public.cargos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cargos" ON public.cargos FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth read warehouses" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write warehouses" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update warehouses" ON public.warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete warehouses" ON public.warehouses FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth read sections" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sections" ON public.sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update sections" ON public.sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete sections" ON public.sections FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth read packages" ON public.packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write packages" ON public.packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update packages" ON public.packages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete packages" ON public.packages FOR DELETE TO authenticated USING (true);

-- Storage bucket for package images
INSERT INTO storage.buckets (id, name, public) VALUES ('package-images', 'package-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read package images" ON storage.objects FOR SELECT USING (bucket_id = 'package-images');
CREATE POLICY "Auth upload package images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'package-images');
CREATE POLICY "Auth update package images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'package-images');
CREATE POLICY "Auth delete package images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'package-images');