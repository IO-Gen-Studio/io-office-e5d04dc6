CREATE TABLE public.fiscal_year_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_month smallint NOT NULL DEFAULT 1 CHECK (start_month BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_year_settings TO authenticated;
GRANT ALL ON public.fiscal_year_settings TO service_role;
ALTER TABLE public.fiscal_year_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fy_settings read" ON public.fiscal_year_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "fy_settings write" ON public.fiscal_year_settings FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_fy_settings_updated BEFORE UPDATE ON public.fiscal_year_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, label),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX fiscal_years_one_current ON public.fiscal_years(tenant_id) WHERE is_current;
CREATE INDEX fiscal_years_tenant_idx ON public.fiscal_years(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_years TO authenticated;
GRANT ALL ON public.fiscal_years TO service_role;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fy read" ON public.fiscal_years FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "fy write" ON public.fiscal_years FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_fy_updated BEFORE UPDATE ON public.fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();