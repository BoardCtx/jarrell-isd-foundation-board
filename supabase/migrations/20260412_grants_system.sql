-- ============================================================================
-- GRANT MANAGEMENT SYSTEM
-- ============================================================================

-- 1. Create system groups: Grant Committee and Grant Admin
-- ============================================================================
insert into public.groups (name, description)
values
  ('Grant Admin', 'Administrators who manage grant applications, scoring criteria, and results'),
  ('Grant Committee', 'Committee members who review and score grant requests')
on conflict do nothing;

-- 2. Grant applicant profiles (external users using Supabase Auth)
-- ============================================================================
create table if not exists public.grant_applicants (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  organization text,
  phone text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.grant_applicants enable row level security;

create policy "Grant applicants can view own profile"
  on public.grant_applicants for select
  using (auth.uid() = id);

create policy "Grant applicants can update own profile"
  on public.grant_applicants for update
  using (auth.uid() = id);

create policy "Grant applicants can insert own profile"
  on public.grant_applicants for insert
  with check (auth.uid() = id);

create policy "Foundation users can view all grant applicants"
  on public.grant_applicants for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

create policy "Foundation admins can manage grant applicants"
  on public.grant_applicants for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- 3. Grant applications (the application template)
-- ============================================================================
create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'scoring', 'decided', 'awarded', 'archived')),
  form_schema jsonb not null default '{"sections": []}',
  scoring_schema jsonb,
  deadline timestamptz,
  followup_open boolean default false,
  followup_deadline timestamptz,
  show_decisions_to_applicants boolean default false,
  max_award_amount numeric(12,2),
  created_by uuid references public.profiles(id),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.grant_applications enable row level security;

create policy "Authenticated users can view open applications"
  on public.grant_applications for select
  using (auth.uid() is not null);

create policy "Foundation users can manage applications"
  on public.grant_applications for all
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 4. Grant requests (submissions by applicants)
-- ============================================================================
create table if not exists public.grant_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.grant_applications(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  form_data jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'partial_funding', 'awarded')),
  decision_visible boolean default false,
  awarded_amount numeric(12,2),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.grant_requests enable row level security;

create policy "Applicants can view own requests"
  on public.grant_requests for select
  using (auth.uid() = applicant_id);

create policy "Applicants can insert own requests"
  on public.grant_requests for insert
  with check (auth.uid() = applicant_id);

create policy "Applicants can update own draft/submitted requests"
  on public.grant_requests for update
  using (auth.uid() = applicant_id);

create policy "Foundation users can view all requests"
  on public.grant_requests for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

create policy "Foundation admins can manage requests"
  on public.grant_requests for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- 5. Grant request files (uploaded by applicants)
-- ============================================================================
create table if not exists public.grant_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.grant_requests(id) on delete cascade,
  field_id text not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

alter table public.grant_request_files enable row level security;

create policy "Applicants can manage own request files"
  on public.grant_request_files for all
  using (auth.uid() = uploaded_by);

create policy "Foundation users can view request files"
  on public.grant_request_files for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 6. Grant scores (committee member evaluations)
-- ============================================================================
create table if not exists public.grant_scores (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.grant_requests(id) on delete cascade,
  application_id uuid not null references public.grant_applications(id) on delete cascade,
  scorer_id uuid not null references public.profiles(id) on delete cascade,
  score_data jsonb not null default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (request_id, scorer_id)
);

alter table public.grant_scores enable row level security;

create policy "Scorers can manage own scores"
  on public.grant_scores for all
  using (auth.uid() = scorer_id);

create policy "Foundation users can view scores"
  on public.grant_scores for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 7. Grant follow-ups (post-award reports)
-- ============================================================================
create table if not exists public.grant_followups (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.grant_requests(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  report_data jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.grant_followups enable row level security;

create policy "Applicants can manage own followups"
  on public.grant_followups for all
  using (auth.uid() = applicant_id);

create policy "Foundation users can view all followups"
  on public.grant_followups for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 8. Grant follow-up files
-- ============================================================================
create table if not exists public.grant_followup_files (
  id uuid primary key default gen_random_uuid(),
  followup_id uuid not null references public.grant_followups(id) on delete cascade,
  field_id text not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

alter table public.grant_followup_files enable row level security;

create policy "Applicants can manage own followup files"
  on public.grant_followup_files for all
  using (auth.uid() = uploaded_by);

create policy "Foundation users can view followup files"
  on public.grant_followup_files for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 9. Grant notification log
-- ============================================================================
create table if not exists public.grant_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.grant_applications(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('scoring_ready', 'decision_made', 'followup_open', 'followup_reminder', 'application_open', 'application_closing')),
  sent_to uuid[] not null default '{}',
  sent_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.grant_notifications enable row level security;

create policy "Foundation users can view notifications"
  on public.grant_notifications for all
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- 10. Storage bucket for grant files
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('grant-files', 'grant-files', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload grant files"
  on storage.objects for insert
  with check (bucket_id = 'grant-files' and auth.uid() is not null);

create policy "Authenticated users can view grant files"
  on storage.objects for select
  using (bucket_id = 'grant-files' and auth.uid() is not null);

create policy "Users can delete own grant files"
  on storage.objects for delete
  using (bucket_id = 'grant-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- 11. Indexes for performance
-- ============================================================================
create index if not exists idx_grant_requests_application on public.grant_requests(application_id);
create index if not exists idx_grant_requests_applicant on public.grant_requests(applicant_id);
create index if not exists idx_grant_scores_request on public.grant_scores(request_id);
create index if not exists idx_grant_scores_application on public.grant_scores(application_id);
create index if not exists idx_grant_scores_scorer on public.grant_scores(scorer_id);
create index if not exists idx_grant_followups_request on public.grant_followups(request_id);
create index if not exists idx_grant_request_files_request on public.grant_request_files(request_id);
