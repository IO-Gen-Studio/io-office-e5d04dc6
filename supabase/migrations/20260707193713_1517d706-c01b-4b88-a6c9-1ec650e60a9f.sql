
-- Add status to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned'
  CHECK (status IN ('planned','in_progress','completed','cancelled'));

-- Seed new lead_status_options per tenant (out of office / auto-reply / forwarded)
INSERT INTO public.lead_status_options (tenant_id, key, label, is_default, position)
SELECT t.id, v.key, v.label, false, v.position
FROM public.tenants t
CROSS JOIN (VALUES
  ('out_of_office','Out of office', 10),
  ('auto_reply','Auto-reply', 11),
  ('forwarded','Forwarded', 12)
) AS v(key,label,position)
ON CONFLICT DO NOTHING;
