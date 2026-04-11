-- ============================================================================
-- Meeting Attendees, Time Zones, and Public Links
-- ============================================================================

-- Add time_zone and public_token to meetings
alter table public.meetings add column if not exists time_zone text default 'America/Chicago';
alter table public.meetings add column if not exists public_token text;

-- Add default time_zone to profiles
alter table public.profiles add column if not exists time_zone text default 'America/Chicago';

-- Create unique index on public_token for fast lookups
create unique index if not exists meetings_public_token_idx on public.meetings(public_token) where public_token is not null;

-- Meeting attendees table (links users to meetings with required/optional)
create table if not exists public.meeting_attendees (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  attendance_type text not null default 'required' check (attendance_type in ('required', 'optional')),
  notified_at timestamptz,
  created_at timestamptz default now(),
  unique(meeting_id, profile_id)
);

alter table public.meeting_attendees enable row level security;

-- Authenticated users can view attendees
create policy "Authenticated users can view meeting attendees"
  on public.meeting_attendees for select to public
  using (auth.role() = 'authenticated');

-- Admins and meeting creators can manage attendees
create policy "Admins can manage meeting attendees"
  on public.meeting_attendees for all to public
  using (
    exists (
      select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president')
    )
    or exists (
      select 1 from meetings where meetings.id = meeting_id and meetings.created_by = auth.uid()
    )
  );

-- Anyone authenticated can insert (creator + admins enforced in app)
create policy "Authenticated users can insert meeting attendees"
  on public.meeting_attendees for insert to public
  with check (auth.role() = 'authenticated');

-- Anyone authenticated can delete (creator + admins enforced in app)
create policy "Authenticated users can delete meeting attendees"
  on public.meeting_attendees for delete to public
  using (auth.role() = 'authenticated');
