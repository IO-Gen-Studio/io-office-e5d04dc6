
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leads_sync_contact() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_lead_defaults_for_tenant(_tenant_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_leads_after_tenant_insert() FROM anon, PUBLIC;
