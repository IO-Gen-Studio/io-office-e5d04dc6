
-- Defense-in-depth: RESTRICTIVE tenant isolation policies
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cost_proposal_settings',
    'fiscal_year_settings',
    'fiscal_years',
    'lead_pipeline_status_options',
    'lead_next_action_options',
    'lead_source_options',
    'lead_field_labels',
    'leads'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_restrictive', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation_restrictive ON public.%I
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id())
    $f$, t);
  END LOOP;
END $$;
