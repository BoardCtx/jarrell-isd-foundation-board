-- ============================================================
-- Document Folders - hierarchical folder system for documents
-- ============================================================

-- Folders table (supports nesting via parent_id)
create table public.document_folders (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  parent_id uuid references public.document_folders(id) on delete cascade,
  icon text default '📁',
  color text default 'bg-gray-100 text-gray-700',
  is_system boolean default false,  -- system folders can't be deleted by users
  meeting_id uuid references public.meetings(id) on delete set null,  -- for auto-created meeting folders
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add folder_id to documents (which folder a document lives in)
alter table public.documents
  add column folder_id uuid references public.document_folders(id) on delete set null;

-- Virtual links: a document can appear in multiple folders without moving
-- Used for meeting folders (document stays in original folder, linked in meeting folder)
create table public.document_folder_links (
  id uuid default uuid_generate_v4() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  folder_id uuid references public.document_folders(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(document_id, folder_id)
);

-- RLS for document_folders
alter table public.document_folders enable row level security;
alter table public.document_folder_links enable row level security;

create policy "Authenticated users can view folders"
  on public.document_folders for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create folders"
  on public.document_folders for insert with check (auth.role() = 'authenticated');

create policy "Creators and admins can update folders"
  on public.document_folders for update using (
    auth.uid() = created_by or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
  );

create policy "Admins can delete non-system folders"
  on public.document_folders for delete using (
    (is_system = false) and (
      auth.uid() = created_by or
      exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'president'))
    )
  );

create policy "Authenticated users can view folder links"
  on public.document_folder_links for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create folder links"
  on public.document_folder_links for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete folder links"
  on public.document_folder_links for delete using (auth.role() = 'authenticated');

-- Seed default folders
insert into public.document_folders (name, icon, color, is_system) values
  ('Financial', '💰', 'bg-yellow-100 text-yellow-700', true),
  ('Governance', '🏛️', 'bg-purple-100 text-purple-700', true),
  ('Development', '🚀', 'bg-blue-100 text-blue-700', true),
  ('Board Meetings', '📋', 'bg-green-100 text-green-700', true),
  ('Grants', '🏆', 'bg-orange-100 text-orange-700', true),
  ('Policies', '📜', 'bg-indigo-100 text-indigo-700', true),
  ('General', '📄', 'bg-gray-100 text-gray-700', true);

-- Drop the category constraint on documents since we're moving to folders
-- (keep the column for backward compatibility but make it optional)
alter table public.documents
  alter column category drop not null,
  alter column category set default null;
