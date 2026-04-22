-- ============================================================================
-- Grant System Enhancement: External Evaluators, Invites, Visibility Settings
-- ============================================================================

-- ── 1. External Evaluator Accounts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.grant_evaluators (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Per-Application Evaluator Assignment ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.grant_evaluator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES public.grant_evaluators(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, evaluator_id)
);

-- ── 3. Per-Application Shareable Invite Links (for applicants) ──────────────

CREATE TABLE IF NOT EXISTS public.grant_application_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  max_uses INT,
  use_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Targeted Applicant Email Invites ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.grant_applicant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invite_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'registered', 'applied')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Add Columns to Existing Tables ───────────────────────────────────────

-- Visibility settings: can former evaluators see past/closed requests?
ALTER TABLE public.grant_applications
  ADD COLUMN IF NOT EXISTS internal_evaluator_past_visibility BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.grant_applications
  ADD COLUMN IF NOT EXISTS external_evaluator_past_visibility BOOLEAN NOT NULL DEFAULT false;

-- Track whether a score came from internal or external evaluator
ALTER TABLE public.grant_scores
  ADD COLUMN IF NOT EXISTS scorer_type TEXT NOT NULL DEFAULT 'internal'
    CHECK (scorer_type IN ('internal', 'external'));

-- ── 6. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grant_evaluators_status ON public.grant_evaluators(status);
CREATE INDEX IF NOT EXISTS idx_grant_evaluators_email ON public.grant_evaluators(email);
CREATE INDEX IF NOT EXISTS idx_grant_evaluator_assignments_app ON public.grant_evaluator_assignments(application_id);
CREATE INDEX IF NOT EXISTS idx_grant_evaluator_assignments_eval ON public.grant_evaluator_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_grant_application_invites_token ON public.grant_application_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_grant_application_invites_app ON public.grant_application_invites(application_id);
CREATE INDEX IF NOT EXISTS idx_grant_applicant_invites_token ON public.grant_applicant_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_grant_applicant_invites_app ON public.grant_applicant_invites(application_id);
CREATE INDEX IF NOT EXISTS idx_grant_applicant_invites_email ON public.grant_applicant_invites(email);
CREATE INDEX IF NOT EXISTS idx_grant_scores_scorer_type ON public.grant_scores(scorer_type);

-- ── 7. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE public.grant_evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_evaluator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_application_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_applicant_invites ENABLE ROW LEVEL SECURITY;

-- Evaluators: can read their own row
CREATE POLICY "evaluators_read_own" ON public.grant_evaluators
  FOR SELECT USING (auth.uid() = id);

-- Evaluators: foundation users can read all (for admin pages)
CREATE POLICY "evaluators_foundation_read" ON public.grant_evaluators
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

-- Evaluators: foundation admins can insert/update/delete
CREATE POLICY "evaluators_admin_write" ON public.grant_evaluators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'president')
        OR id IN (
          SELECT gm.profile_id FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE g.name = 'Grant Admin'
        )
      )
    )
  );

-- Evaluators can insert their own row (on registration)
CREATE POLICY "evaluators_self_insert" ON public.grant_evaluators
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Evaluators can update their own row (profile edits)
CREATE POLICY "evaluators_self_update" ON public.grant_evaluators
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Evaluator assignments: evaluators can read their own assignments
CREATE POLICY "eval_assignments_read_own" ON public.grant_evaluator_assignments
  FOR SELECT USING (evaluator_id = auth.uid());

-- Evaluator assignments: foundation users can read all
CREATE POLICY "eval_assignments_foundation_read" ON public.grant_evaluator_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

-- Evaluator assignments: admin write
CREATE POLICY "eval_assignments_admin_write" ON public.grant_evaluator_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'president')
        OR id IN (
          SELECT gm.profile_id FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE g.name = 'Grant Admin'
        )
      )
    )
  );

-- Application invites: public can read by token (for landing pages)
CREATE POLICY "app_invites_public_read" ON public.grant_application_invites
  FOR SELECT USING (true);

-- Application invites: admin write
CREATE POLICY "app_invites_admin_write" ON public.grant_application_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'president')
        OR id IN (
          SELECT gm.profile_id FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE g.name = 'Grant Admin'
        )
      )
    )
  );

-- Applicant invites: public can read by token
CREATE POLICY "applicant_invites_public_read" ON public.grant_applicant_invites
  FOR SELECT USING (true);

-- Applicant invites: admin write
CREATE POLICY "applicant_invites_admin_write" ON public.grant_applicant_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'president')
        OR id IN (
          SELECT gm.profile_id FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE g.name = 'Grant Admin'
        )
      )
    )
  );

-- Allow external evaluators to read grant_requests for their assigned applications
CREATE POLICY "evaluators_read_assigned_requests" ON public.grant_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.grant_evaluator_assignments ea
      WHERE ea.evaluator_id = auth.uid()
      AND ea.application_id = grant_requests.application_id
    )
  );

-- Allow external evaluators to read grant_applications they're assigned to
CREATE POLICY "evaluators_read_assigned_applications" ON public.grant_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.grant_evaluator_assignments ea
      WHERE ea.evaluator_id = auth.uid()
      AND ea.application_id = grant_applications.id
    )
  );

-- Allow external evaluators to insert/update scores for assigned applications
CREATE POLICY "evaluators_write_scores" ON public.grant_scores
  FOR INSERT WITH CHECK (
    scorer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.grant_evaluator_assignments ea
      WHERE ea.evaluator_id = auth.uid()
      AND ea.application_id = grant_scores.application_id
    )
  );

CREATE POLICY "evaluators_update_scores" ON public.grant_scores
  FOR UPDATE USING (
    scorer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.grant_evaluator_assignments ea
      WHERE ea.evaluator_id = auth.uid()
      AND ea.application_id = grant_scores.application_id
    )
  );

-- ── 8. Updated_at Triggers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_grant_evaluators_updated_at
  BEFORE UPDATE ON public.grant_evaluators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
