ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS subscriptions_project_id_idx ON public.subscriptions(project_id);