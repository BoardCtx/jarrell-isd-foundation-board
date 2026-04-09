-- ============================================================
-- Jarrell ISD Education Foundation Board App
-- Supabase Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'president', 'secretary', 'treasurer', 'member')),
  title text,
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed', 'on_hold', 'cancelled')),
  category text,
  budget_goal numeric(12,2) default 0,
  amount_raised numeric(12,2) default 0,
  start_date date,
  end_date date,
  lead_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.profiles(id),
  due_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- BUDGET / DONATIONS / EXPENSES
-- ============================================================
create table public.budget_items (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('donation', 'grant', 'expense', 'transfer')),
  description text not null,
  amount numeric(12,2) not null,
  project_id uuid references public.projects(id) on delete set null,
  donor_name text,
  date date not null default current_date,
  category text,
  notes text,
  receipt_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MEETINGS
-- ============================================================
create table public.meetings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  type text not null default 'regular' check (type in ('regular', 'special', 'annual', 'committee')),
  date date not null,
  time time,
  location text,
  virtual_link text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  agenda text,
  agenda_published boolean default false,
  minutes text,
  minutes_published boolean default false,
  attendees uuid[],
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  category text not null default 'general' check (category in ('agenda', 'minutes', 'financial', 'policy', 'grant', 'general', 'other')),
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  project_id uuid references public.projects(id) on delete set null,
  meeting_id uuid references public.meetings(id) on delete set null,
  is_public boolean default false,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.budget_items enable row level security;
alter table public.meetings enable row level security;
alter table public.documents enable row level security;

-- Profiles: users can see all active profiles, edit their own
create policy "All authenticated users can view profiles"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Projects: all authenticated users can view; admins/leads can edit
create policy "Authenticated users can view projects"
  on public.projects for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert projects"
  on public.projects for insert with check (auth.role() = 'authenticated');

create policy "Admins and leads can update projects"
  on public.projects for update using (
    auth.uid() = lead_id or auth.uid() = created_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

create policy "Admins can delete projects"
  on public.projects for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- Tasks: similar pattern
create policy "Authenticated users can view tasks"
  on public.tasks for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert tasks"
  on public.tasks for insert with check (auth.role() = 'authenticated');

create policy "Assignees and creators can update tasks"
  on public.tasks for update using (
    auth.uid() = assignee_id or auth.uid() = created_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

create policy "Admins can delete tasks"
  on public.tasks for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- Budget: all authenticated can view; treasurer/admin can edit
create policy "Authenticated users can view budget"
  on public.budget_items for select using (auth.role() = 'authenticated');

create policy "Treasurer and admin can insert budget items"
  on public.budget_items for insert with check (auth.role() = 'authenticated');

create policy "Treasurer and admin can update budget items"
  on public.budget_items for update using (
    auth.uid() = created_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president', 'treasurer'))
  );

create policy "Admins can delete budget items"
  on public.budget_items for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president', 'treasurer'))
  );

-- Meetings
create policy "Authenticated users can view meetings"
  on public.meetings for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert meetings"
  on public.meetings for insert with check (auth.role() = 'authenticated');

create policy "Creators and admins can update meetings"
  on public.meetings for update using (
    auth.uid() = created_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president', 'secretary'))
  );

create policy "Admins can delete meetings"
  on public.meetings for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- Documents
create policy "Authenticated users can view documents"
  on public.documents for select using (auth.role() = 'authenticated');

create policy "Authenticated users can upload documents"
  on public.documents for insert with check (auth.role() = 'authenticated');

create policy "Uploaders and admins can update documents"
  on public.documents for update using (
    auth.uid() = uploaded_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

create policy "Admins can delete documents"
  on public.documents for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

-- ============================================================
-- STORAGE BUCKET (run in Supabase dashboard > Storage)
-- ============================================================
-- Create a bucket named "documents" with 50MB file size limit
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values ('documents', 'documents', false, 52428800, null);
