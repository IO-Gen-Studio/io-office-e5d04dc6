ALTER TABLE public.lead_status_options DROP CONSTRAINT IF EXISTS lead_status_options_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS lead_status_options_tenant_key_uidx ON public.lead_status_options (tenant_id, key);

INSERT INTO public.lead_status_options (tenant_id, key, label, position)
SELECT t.id, v.key, v.label, v.position
FROM public.tenants t
CROSS JOIN (VALUES ('auto_reply','Auto-reply',20),('invalid_email','Invalid Email',21)) AS v(key,label,position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_status_options o WHERE o.tenant_id = t.id AND o.key = v.key
);