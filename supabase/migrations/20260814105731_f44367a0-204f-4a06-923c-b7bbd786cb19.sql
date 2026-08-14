ALTER TABLE public.cost_versions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.cost_items ADD COLUMN IF NOT EXISTS invoiced boolean NOT NULL DEFAULT false;