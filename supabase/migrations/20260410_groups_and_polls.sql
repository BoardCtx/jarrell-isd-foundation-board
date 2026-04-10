-- ============================================================================
-- Groups & Polls Schema Migration
-- ============================================================================

-- Groups table
create table if not exists public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Group memberships
create table if not exists public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  added_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(group_id, profile_id)
);

-- Polls table
create table if not exists public.polls (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  allow_multiple boolean default false,
  status text default 'active' check (status in ('active', 'closed')),
  created_by uuid references public.profiles(id) not null,
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Poll options (the choices voters can pick)
create table if not exists public.poll_options (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  label text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Poll document attachments (link polls to existing documents)
create table if not exists public.poll_document_links (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(poll_id, document_id)
);

-- Poll recipients (who is invited to vote — individual users or via group expansion)
create table if not exists public.poll_recipients (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  notified_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz default now(),
  unique(poll_id, profile_id)
);

-- Poll votes (records each person's vote)
create table if not exists public.poll_votes (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  option_id uuid references public.poll_options(id) on delete cascade not null,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(poll_id, option_id, voter_id)
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_document_links enable row level security;
alter table public.poll_recipients enable row level security;
alter table public.poll_votes enable row level security;

-- Groups: authenticated users can view; admins can manage
create policy "Authenticated users can view groups" on public.groups for select to public using (auth.role() = 'authenticated');
create policy "Admins can manage groups" on public.groups for all to public using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president'))
);
create policy "Authenticated users can insert groups" on public.groups for insert to public with check (auth.role() = 'authenticated');

-- Group members
create policy "Authenticated users can view group members" on public.group_members for select to public using (auth.role() = 'authenticated');
create policy "Admins can manage group members" on public.group_members for all to public using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president'))
);
create policy "Authenticated users can insert group members" on public.group_members for insert to public with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete group members" on public.group_members for delete to public using (auth.role() = 'authenticated');

-- Polls: anyone authenticated can view and create
create policy "Authenticated users can view polls" on public.polls for select to public using (auth.role() = 'authenticated');
create policy "Authenticated users can create polls" on public.polls for insert to public with check (auth.role() = 'authenticated');
create policy "Creators can update their polls" on public.polls for update to public using (created_by = auth.uid());
create policy "Creators can delete their polls" on public.polls for delete to public using (created_by = auth.uid());

-- Poll options
create policy "Authenticated users can view poll options" on public.poll_options for select to public using (auth.role() = 'authenticated');
create policy "Authenticated users can manage poll options" on public.poll_options for insert to public with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete poll options" on public.poll_options for delete to public using (auth.role() = 'authenticated');

-- Poll document links
create policy "Authenticated users can view poll doc links" on public.poll_document_links for select to public using (auth.role() = 'authenticated');
create policy "Authenticated users can manage poll doc links" on public.poll_document_links for insert to public with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete poll doc links" on public.poll_document_links for delete to public using (auth.role() = 'authenticated');

-- Poll recipients
create policy "Authenticated users can view poll recipients" on public.poll_recipients for select to public using (auth.role() = 'authenticated');
create policy "Authenticated users can manage poll recipients" on public.poll_recipients for insert to public with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete poll recipients" on public.poll_recipients for delete to public using (auth.role() = 'authenticated');

-- Poll votes: voters can see all votes, can insert their own
create policy "Authenticated users can view votes" on public.poll_votes for select to public using (auth.role() = 'authenticated');
create policy "Users can cast votes" on public.poll_votes for insert to public with check (auth.role() = 'authenticated' and voter_id = auth.uid());
create policy "Users can change votes" on public.poll_votes for delete to public using (voter_id = auth.uid());
