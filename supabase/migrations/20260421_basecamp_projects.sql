-- ============================================================
-- Basecamp-Style Project Management — Schema Migration
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROJECT MEMBERS (team per project)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project members"
  ON public.project_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Project leads and admins can manage members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.profile_id = auth.uid()
        AND pm.role = 'lead'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'president')
    )
  );

CREATE POLICY "Authenticated users can insert project members"
  ON public.project_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 2. MESSAGE BOARD
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN ('general', 'announcement', 'question', 'update', 'fyi')),
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages"
  ON public.project_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create messages"
  ON public.project_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors and admins can update messages"
  ON public.project_messages FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'president')
    )
  );

CREATE POLICY "Authors and admins can delete messages"
  ON public.project_messages FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'president')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. MESSAGE COMMENTS (threaded replies)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.message_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.project_messages(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view message comments"
  ON public.message_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create message comments"
  ON public.message_comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can update own comments"
  ON public.message_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Authors and admins can delete comments"
  ON public.message_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'president')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. TO-DO GROUPS (Basecamp-style grouped lists)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_todo_groups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_todo_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view todo groups"
  ON public.project_todo_groups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage todo groups"
  ON public.project_todo_groups FOR ALL
  USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 5. TO-DO ITEMS (individual items within groups)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_todos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  todo_group_id uuid NOT NULL REFERENCES public.project_todo_groups(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id),
  assignee_id uuid REFERENCES public.profiles(id),
  due_date date,
  sort_order int DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view todos"
  ON public.project_todos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage todos"
  ON public.project_todos FOR ALL
  USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 6. MILESTONES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_milestones (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_date date,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  sort_order int DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view milestones"
  ON public.project_milestones FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage milestones"
  ON public.project_milestones FOR ALL
  USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 7. ACTIVITY FEED (auto-logged events)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_activity (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  -- e.g. 'created_message', 'completed_todo', 'added_member', 'created_milestone', 'uploaded_document'
  target_type text,
  -- e.g. 'message', 'todo', 'milestone', 'member', 'document'
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  -- extra context: { title: "...", assignee_name: "..." }
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity"
  ON public.project_activity FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create activity"
  ON public.project_activity FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 8. INDEXES for performance
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_profile ON public.project_members(profile_id);
CREATE INDEX idx_project_messages_project ON public.project_messages(project_id);
CREATE INDEX idx_project_messages_created ON public.project_messages(created_at DESC);
CREATE INDEX idx_message_comments_message ON public.message_comments(message_id);
CREATE INDEX idx_todo_groups_project ON public.project_todo_groups(project_id);
CREATE INDEX idx_todos_group ON public.project_todos(todo_group_id);
CREATE INDEX idx_todos_project ON public.project_todos(project_id);
CREATE INDEX idx_todos_assignee ON public.project_todos(assignee_id);
CREATE INDEX idx_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_activity_project ON public.project_activity(project_id);
CREATE INDEX idx_activity_created ON public.project_activity(created_at DESC);
