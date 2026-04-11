-- ============================================================
-- Task Assignees (many-to-many: tasks ↔ profiles/groups)
-- ============================================================
create table if not exists task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(task_id, profile_id)
);

alter table task_assignees enable row level security;

create policy "Authenticated users can view task assignees"
  on task_assignees for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert task assignees"
  on task_assignees for insert
  with check (auth.role() = 'authenticated');

create policy "Admins and creators can delete task assignees"
  on task_assignees for delete
  using (
    auth.uid() = assigned_by
    or exists (
      select 1 from tasks where tasks.id = task_assignees.task_id and tasks.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president')
    )
  );

-- ============================================================
-- Task Comments
-- ============================================================
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table task_comments enable row level security;

create policy "Authenticated users can view task comments"
  on task_comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert task comments"
  on task_comments for insert
  with check (auth.role() = 'authenticated');

create policy "Authors can update their comments"
  on task_comments for update
  using (auth.uid() = author_id);

create policy "Authors and admins can delete comments"
  on task_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president')
    )
  );

-- ============================================================
-- Task Documents (files attached to tasks)
-- ============================================================
create table if not exists task_documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz default now()
);

alter table task_documents enable row level security;

create policy "Authenticated users can view task documents"
  on task_documents for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert task documents"
  on task_documents for insert
  with check (auth.role() = 'authenticated');

create policy "Uploaders and admins can delete task documents"
  on task_documents for delete
  using (
    auth.uid() = uploaded_by
    or exists (
      select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'president')
    )
  );

-- ============================================================
-- Create a storage bucket for task documents
-- ============================================================
insert into storage.buckets (id, name, public) values ('task-documents', 'task-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload task documents"
  on storage.objects for insert
  with check (bucket_id = 'task-documents' and auth.role() = 'authenticated');

create policy "Authenticated users can view task documents"
  on storage.objects for select
  using (bucket_id = 'task-documents' and auth.role() = 'authenticated');

create policy "Authenticated users can delete their task documents"
  on storage.objects for delete
  using (bucket_id = 'task-documents' and auth.role() = 'authenticated');
