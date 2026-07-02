
-- Leads module tables
CREATE TABLE public.lead_pipeline_status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_pipeline_status_options TO authenticated;
GRANT ALL ON public.lead_pipeline_status_options TO service_role;
ALTER TABLE public.lead_pipeline_status_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps select" ON public.lead_pipeline_status_options FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), 'crm'::app_module)));
CREATE POLICY "lps admin write" ON public.lead_pipeline_status_options FOR ALL TO authenticated USING (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id())) WITH CHECK (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id()));

CREATE TABLE public.lead_next_action_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_next_action_options TO authenticated;
GRANT ALL ON public.lead_next_action_options TO service_role;
ALTER TABLE public.lead_next_action_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lna select" ON public.lead_next_action_options FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), 'crm'::app_module)));
CREATE POLICY "lna admin write" ON public.lead_next_action_options FOR ALL TO authenticated USING (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id())) WITH CHECK (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id()));

CREATE TABLE public.lead_source_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_source_options TO authenticated;
GRANT ALL ON public.lead_source_options TO service_role;
ALTER TABLE public.lead_source_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lso select" ON public.lead_source_options FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), 'crm'::app_module)));
CREATE POLICY "lso admin write" ON public.lead_source_options FOR ALL TO authenticated USING (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id())) WITH CHECK (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id()));

CREATE TABLE public.lead_field_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_field_labels TO authenticated;
GRANT ALL ON public.lead_field_labels TO service_role;
ALTER TABLE public.lead_field_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lfl select" ON public.lead_field_labels FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), 'crm'::app_module)));
CREATE POLICY "lfl admin write" ON public.lead_field_labels FOR ALL TO authenticated USING (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id())) WITH CHECK (is_super_admin(auth.uid()) OR (is_admin(auth.uid()) AND tenant_id = current_tenant_id()));

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  job_title text,
  company_name text,
  email text,
  phone text,
  status_id uuid REFERENCES public.lead_pipeline_status_options(id) ON DELETE SET NULL,
  intent text CHECK (intent IN ('high','medium','low')),
  source_id uuid REFERENCES public.lead_source_options(id) ON DELETE SET NULL,
  opportunity_gbp numeric(14,2),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action_id uuid REFERENCES public.lead_next_action_options(id) ON DELETE SET NULL,
  next_action_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX idx_leads_next_action_date ON public.leads(next_action_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads select" ON public.leads FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), 'crm'::app_module)));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND can_edit_module(auth.uid(), 'crm'::app_module)));
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND can_edit_module(auth.uid(), 'crm'::app_module))) WITH CHECK (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND can_edit_module(auth.uid(), 'crm'::app_module)));
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND can_edit_module(auth.uid(), 'crm'::app_module)));

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create matching contact when a lead is inserted without one
CREATE OR REPLACE FUNCTION public.leads_sync_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_contact_id uuid;
BEGIN
  IF NEW.contact_id IS NULL THEN
    INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone, job_title, organisation_id, is_lead, created_by)
    VALUES (NEW.tenant_id, COALESCE(NEW.first_name,''), COALESCE(NEW.last_name,''), NEW.email, NEW.phone, NEW.job_title, NEW.organisation_id, true, NEW.created_by)
    RETURNING id INTO new_contact_id;
    NEW.contact_id := new_contact_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER leads_sync_contact_trg BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_sync_contact();

-- Seed default options + field labels for existing tenants
INSERT INTO public.lead_pipeline_status_options (tenant_id, key, label, color, position)
SELECT t.id, s.key, s.label, s.color, s.pos
FROM public.tenants t
CROSS JOIN (VALUES
  ('new','New','blue',1),
  ('qualified','Qualified','emerald',2),
  ('demo_scheduled','Demo Scheduled','purple',3),
  ('proposal_sent','Proposal Sent','indigo',4),
  ('negotiation','Negotiation','amber',5),
  ('contacted','Contacted','slate',6),
  ('won','Won','emerald',7),
  ('lost','Lost','rose',8)
) AS s(key,label,color,pos)
ON CONFLICT DO NOTHING;

INSERT INTO public.lead_next_action_options (tenant_id, label, position)
SELECT t.id, a.label, a.pos
FROM public.tenants t
CROSS JOIN (VALUES
  ('Intro Outreach',1),('Meeting Scheduled',2),('Send Proposal',3),
  ('Follow-up Call',4),('Pricing Discussion',5),('Send Case Study',6),
  ('Contract Review',7),('Closed',8)
) AS a(label,pos)
ON CONFLICT DO NOTHING;

INSERT INTO public.lead_source_options (tenant_id, label, position)
SELECT t.id, s.label, s.pos
FROM public.tenants t
CROSS JOIN (VALUES
  ('LinkedIn',1),('Referral',2),('Website',3),('Event',4),
  ('Cold Email',5),('Google Ads',6),('Organic Search',7),('Other',8)
) AS s(label,pos)
ON CONFLICT DO NOTHING;

INSERT INTO public.lead_field_labels (tenant_id, field_key, label, position)
SELECT t.id, f.k, f.l, f.p
FROM public.tenants t
CROSS JOIN (VALUES
  ('lead','Lead',1),('status','Status',2),('intent','Intent',3),
  ('source','Source',4),('opportunity','Opportunity',5),
  ('assigned','Assigned',6),('next_action','Next Action',7),
  ('next_action_date','Action Date',8),('notes','Notes',9)
) AS f(k,l,p)
ON CONFLICT DO NOTHING;

-- Seed for any newly-created tenant
CREATE OR REPLACE FUNCTION public.seed_lead_defaults_for_tenant(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lead_pipeline_status_options (tenant_id, key, label, color, position) VALUES
    (_tenant_id,'new','New','blue',1),(_tenant_id,'qualified','Qualified','emerald',2),
    (_tenant_id,'demo_scheduled','Demo Scheduled','purple',3),(_tenant_id,'proposal_sent','Proposal Sent','indigo',4),
    (_tenant_id,'negotiation','Negotiation','amber',5),(_tenant_id,'contacted','Contacted','slate',6),
    (_tenant_id,'won','Won','emerald',7),(_tenant_id,'lost','Lost','rose',8)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.lead_next_action_options (tenant_id, label, position) VALUES
    (_tenant_id,'Intro Outreach',1),(_tenant_id,'Meeting Scheduled',2),(_tenant_id,'Send Proposal',3),
    (_tenant_id,'Follow-up Call',4),(_tenant_id,'Pricing Discussion',5),(_tenant_id,'Send Case Study',6),
    (_tenant_id,'Contract Review',7),(_tenant_id,'Closed',8)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.lead_source_options (tenant_id, label, position) VALUES
    (_tenant_id,'LinkedIn',1),(_tenant_id,'Referral',2),(_tenant_id,'Website',3),(_tenant_id,'Event',4),
    (_tenant_id,'Cold Email',5),(_tenant_id,'Google Ads',6),(_tenant_id,'Organic Search',7),(_tenant_id,'Other',8)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.lead_field_labels (tenant_id, field_key, label, position) VALUES
    (_tenant_id,'lead','Lead',1),(_tenant_id,'status','Status',2),(_tenant_id,'intent','Intent',3),
    (_tenant_id,'source','Source',4),(_tenant_id,'opportunity','Opportunity',5),
    (_tenant_id,'assigned','Assigned',6),(_tenant_id,'next_action','Next Action',7),
    (_tenant_id,'next_action_date','Action Date',8),(_tenant_id,'notes','Notes',9)
  ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_leads_after_tenant_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_lead_defaults_for_tenant(NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER tenants_seed_leads AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.seed_leads_after_tenant_insert();
