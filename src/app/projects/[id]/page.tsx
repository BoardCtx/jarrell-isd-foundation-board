'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, statusColors } from '@/lib/utils';
import Avatar from '@/components/Avatar';
import type { Profile } from '@/lib/database.types';
import {
  ArrowLeft, Loader2, MessageSquare, CheckSquare, Flag, Users,
  FileText, Activity, Plus, Pencil, X, ChevronDown, ChevronRight,
  Trash2, Send, Pin, Calendar, CheckCircle2, Circle, Clock,
  MoreHorizontal, AlertCircle, Upload, Download, File, Lock, DollarSign,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  budget_goal: number;
  amount_raised: number;
  start_date: string | null;
  end_date: string | null;
  lead_id: string | null;
  created_by: string | null;
  created_at: string;
  lead?: Profile | null;
}

interface ProjectMemberRow {
  id: string;
  project_id: string;
  profile_id: string;
  role: string;
  created_at: string;
  profile?: Profile;
}

interface Message {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  body: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  comment_count?: number;
}

interface MsgComment {
  id: string;
  message_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Profile;
}

interface TodoGroup {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_completed: boolean;
  created_at: string;
  todos?: TodoItem[];
}

interface TodoItem {
  id: string;
  todo_group_id: string;
  project_id: string;
  title: string;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  assignee_id: string | null;
  due_date: string | null;
  sort_order: number;
  assignee?: Profile;
}

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface ActivityItem {
  id: string;
  project_id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: any;
  created_at: string;
  actor?: Profile;
}

// ── View type ──────────────────────────────────────────────────────────────

type ProjectView = 'overview' | 'messages' | 'message-detail' | 'todos' | 'milestones' | 'documents' | 'budget' | 'team' | 'activity';

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ProjectView>('overview');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Data
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [todoGroups, setTodoGroups] = useState<TodoGroup[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Message detail
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [msgComments, setMsgComments] = useState<MsgComment[]>([]);

  // Forms
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: '', body: '', category: 'general' });
  const [commentText, setCommentText] = useState('');
  const [showTodoGroupForm, setShowTodoGroupForm] = useState(false);
  const [todoGroupTitle, setTodoGroupTitle] = useState('');
  const [newTodoText, setNewTodoText] = useState<Record<string, string>>({});
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', target_date: '' });
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  // Collapsed groups & expanded todo detail
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);

  // Documents
  const [projectDocs, setProjectDocs] = useState<Array<{
    id: string; title: string; file_path: string; file_name: string;
    file_size: number | null; mime_type: string | null;
    uploaded_by: string | null; created_at: string; uploader?: Profile;
  }>>([]);
  const [docUploading, setDocUploading] = useState(false);

  // Budget
  const [budgetItems, setBudgetItems] = useState<Array<{
    id: string; type: string; description: string; amount: number;
    donor_name: string | null; date: string; category: string | null;
    notes: string | null; created_at: string;
  }>>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    type: 'donation', description: '', amount: '', donor_name: '', date: new Date().toISOString().split('T')[0], category: '', notes: '',
  });

  // ── Fetch project and core data ──────────────────────────────────────────

  const fetchProject = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setIsAdmin(profile?.role === 'admin' || profile?.role === 'president');

    const [
      { data: proj },
      { data: mems },
      { data: msgs },
      { data: tgs },
      { data: todos },
      { data: mils },
      { data: act },
      { data: profiles },
      { data: docs },
      { data: budgetData },
    ] = await Promise.all([
      supabase.from('projects').select('*, lead:profiles!projects_lead_id_fkey(*)').eq('id', projectId).single(),
      supabase.from('project_members').select('*, profile:profiles(*)').eq('project_id', projectId),
      supabase.from('project_messages').select('*, author:profiles!project_messages_author_id_fkey(id, full_name, avatar_url)').eq('project_id', projectId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('project_todo_groups').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('project_todos').select('*, assignee:profiles!project_todos_assignee_id_fkey(id, full_name, avatar_url)').eq('project_id', projectId).order('sort_order'),
      supabase.from('project_milestones').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('project_activity').select('*, actor:profiles!project_activity_actor_id_fkey(id, full_name, avatar_url)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('documents').select('*, uploader:profiles!documents_uploaded_by_fkey(id, full_name, avatar_url)').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('budget_items').select('*').eq('project_id', projectId).order('date', { ascending: false }),
    ]);

    setProject(proj as ProjectDetail);
    setMembers((mems || []) as ProjectMemberRow[]);
    setAllProfiles(profiles || []);

    // Count comments per message
    const msgsWithCounts = (msgs || []) as Message[];
    if (msgsWithCounts.length > 0) {
      const msgIds = msgsWithCounts.map(m => m.id);
      const { data: commentCounts } = await supabase
        .from('message_comments')
        .select('message_id')
        .in('message_id', msgIds);

      const countMap: Record<string, number> = {};
      (commentCounts || []).forEach((c: any) => {
        countMap[c.message_id] = (countMap[c.message_id] || 0) + 1;
      });
      msgsWithCounts.forEach(m => { m.comment_count = countMap[m.id] || 0; });
    }
    setMessages(msgsWithCounts);

    // Merge todos into groups
    const groupedTodos = (tgs || []).map((g: any) => ({
      ...g,
      todos: (todos || []).filter((t: any) => t.todo_group_id === g.id),
    }));
    setTodoGroups(groupedTodos as TodoGroup[]);

    setMilestones((mils || []) as Milestone[]);
    setActivity((act || []) as ActivityItem[]);
    setProjectDocs((docs || []) as any[]);
    setBudgetItems((budgetData || []) as any[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // ── Activity logger ─────────────────────────────────────────────────────

  const logActivity = async (action: string, targetType?: string, targetId?: string, metadata?: any) => {
    await supabase.from('project_activity').insert({
      project_id: projectId,
      actor_id: currentUserId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || {},
    });
  };

  // ── Messages ────────────────────────────────────────────────────────────

  const handleCreateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgForm.title.trim() || !msgForm.body.trim()) return;
    setSaving(true);

    const { data: newMsg } = await supabase
      .from('project_messages')
      .insert({
        project_id: projectId,
        author_id: currentUserId,
        title: msgForm.title,
        body: msgForm.body,
        category: msgForm.category,
      })
      .select('*, author:profiles!project_messages_author_id_fkey(id, full_name, avatar_url)')
      .single();

    if (newMsg) {
      await logActivity('created_message', 'message', newMsg.id, { title: msgForm.title });
      setMessages(prev => [{ ...newMsg, comment_count: 0 } as Message, ...prev]);
      setMsgForm({ title: '', body: '', category: 'general' });
      setShowMsgForm(false);
    }
    setSaving(false);
  };

  const openMessage = async (msg: Message) => {
    setSelectedMessage(msg);
    setCurrentView('message-detail');

    const { data: comments } = await supabase
      .from('message_comments')
      .select('*, author:profiles!message_comments_author_id_fkey(id, full_name, avatar_url)')
      .eq('message_id', msg.id)
      .order('created_at');

    setMsgComments((comments || []) as MsgComment[]);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedMessage) return;
    setSaving(true);

    const { data: newComment } = await supabase
      .from('message_comments')
      .insert({
        message_id: selectedMessage.id,
        author_id: currentUserId,
        body: commentText.trim(),
      })
      .select('*, author:profiles!message_comments_author_id_fkey(id, full_name, avatar_url)')
      .single();

    if (newComment) {
      setMsgComments(prev => [...prev, newComment as MsgComment]);
      setCommentText('');
      // Update comment count
      setMessages(prev => prev.map(m =>
        m.id === selectedMessage.id ? { ...m, comment_count: (m.comment_count || 0) + 1 } : m
      ));
    }
    setSaving(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Delete this message and all its comments?')) return;
    await supabase.from('project_messages').delete().eq('id', msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (selectedMessage?.id === msgId) {
      setCurrentView('messages');
      setSelectedMessage(null);
    }
  };

  const handleTogglePin = async (msg: Message) => {
    await supabase.from('project_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !m.is_pinned } : m));
  };

  // ── To-Do Groups & Items ────────────────────────────────────────────────

  const handleCreateTodoGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoGroupTitle.trim()) return;
    setSaving(true);

    const { data: newGroup } = await supabase
      .from('project_todo_groups')
      .insert({
        project_id: projectId,
        title: todoGroupTitle.trim(),
        created_by: currentUserId,
        sort_order: todoGroups.length,
      })
      .select()
      .single();

    if (newGroup) {
      await logActivity('created_todo_group', 'todo_group', newGroup.id, { title: todoGroupTitle });
      setTodoGroups(prev => [...prev, { ...newGroup, todos: [] }]);
      setTodoGroupTitle('');
      setShowTodoGroupForm(false);
    }
    setSaving(false);
  };

  const handleAddTodo = async (groupId: string) => {
    const text = newTodoText[groupId]?.trim();
    if (!text) return;

    const group = todoGroups.find(g => g.id === groupId);
    const sortOrder = group?.todos?.length || 0;

    const { data: newTodo } = await supabase
      .from('project_todos')
      .insert({
        todo_group_id: groupId,
        project_id: projectId,
        title: text,
        created_by: currentUserId,
        sort_order: sortOrder,
      })
      .select('*, assignee:profiles!project_todos_assignee_id_fkey(id, full_name, avatar_url)')
      .single();

    if (newTodo) {
      await logActivity('created_todo', 'todo', newTodo.id, { title: text });
      setTodoGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, todos: [...(g.todos || []), newTodo as TodoItem] } : g
      ));
      setNewTodoText(prev => ({ ...prev, [groupId]: '' }));
    }
  };

  const handleToggleTodo = async (todo: TodoItem) => {
    const nowCompleted = !todo.is_completed;
    const updates: any = {
      is_completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
      completed_by: nowCompleted ? currentUserId : null,
    };

    await supabase.from('project_todos').update(updates).eq('id', todo.id);

    if (nowCompleted) {
      await logActivity('completed_todo', 'todo', todo.id, { title: todo.title });
    }

    setTodoGroups(prev => prev.map(g => ({
      ...g,
      todos: g.todos?.map(t => t.id === todo.id ? { ...t, ...updates } : t),
    })));
  };

  const handleDeleteTodoGroup = async (groupId: string) => {
    if (!confirm('Delete this to-do list and all its items?')) return;
    await supabase.from('project_todo_groups').delete().eq('id', groupId);
    setTodoGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const handleUpdateTodoAssignee = async (todo: TodoItem, assigneeId: string | null) => {
    await supabase.from('project_todos').update({ assignee_id: assigneeId }).eq('id', todo.id);

    const assignee = assigneeId ? allProfiles.find(p => p.id === assigneeId) || null : null;
    if (assigneeId && assignee) {
      await logActivity('assigned_todo', 'todo', todo.id, { title: todo.title, assignee_name: assignee.full_name });
    }

    setTodoGroups(prev => prev.map(g => ({
      ...g,
      todos: g.todos?.map(t => t.id === todo.id ? { ...t, assignee_id: assigneeId, assignee: assignee as Profile | undefined } : t),
    })));
  };

  const handleUpdateTodoDueDate = async (todo: TodoItem, dueDate: string | null) => {
    await supabase.from('project_todos').update({ due_date: dueDate || null }).eq('id', todo.id);

    if (dueDate) {
      await logActivity('set_due_date', 'todo', todo.id, { title: todo.title, due_date: dueDate });
    }

    setTodoGroups(prev => prev.map(g => ({
      ...g,
      todos: g.todos?.map(t => t.id === todo.id ? { ...t, due_date: dueDate || null } : t),
    })));
  };

  const handleUpdateTodoNotes = async (todo: TodoItem, notes: string) => {
    await supabase.from('project_todos').update({ notes: notes || null }).eq('id', todo.id);
    setTodoGroups(prev => prev.map(g => ({
      ...g,
      todos: g.todos?.map(t => t.id === todo.id ? { ...t, notes: notes || null } : t),
    })));
  };

  const handleDeleteTodo = async (todoId: string, groupId: string) => {
    await supabase.from('project_todos').delete().eq('id', todoId);
    setTodoGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, todos: g.todos?.filter(t => t.id !== todoId) } : g
    ));
    setExpandedTodoId(null);
  };

  // ── Milestones ──────────────────────────────────────────────────────────

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneForm.title.trim()) return;
    setSaving(true);

    const { data: newMil } = await supabase
      .from('project_milestones')
      .insert({
        project_id: projectId,
        title: milestoneForm.title,
        description: milestoneForm.description || null,
        target_date: milestoneForm.target_date || null,
        created_by: currentUserId,
        sort_order: milestones.length,
      })
      .select()
      .single();

    if (newMil) {
      await logActivity('created_milestone', 'milestone', newMil.id, { title: milestoneForm.title });
      setMilestones(prev => [...prev, newMil as Milestone]);
      setMilestoneForm({ title: '', description: '', target_date: '' });
      setShowMilestoneForm(false);
    }
    setSaving(false);
  };

  const handleToggleMilestone = async (mil: Milestone) => {
    const nowCompleted = !mil.is_completed;
    await supabase.from('project_milestones').update({
      is_completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    }).eq('id', mil.id);

    if (nowCompleted) {
      await logActivity('completed_milestone', 'milestone', mil.id, { title: mil.title });
    }

    setMilestones(prev => prev.map(m =>
      m.id === mil.id ? { ...m, is_completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null } : m
    ));
  };

  // ── Documents ───────────────────────────────────────────────────────────

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);

    const filePath = `projects/${projectId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setDocUploading(false);
      return;
    }

    const { data: newDoc } = await supabase.from('documents').insert({
      title: file.name,
      description: null,
      category: 'general' as any,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      project_id: projectId,
      meeting_id: null,
      folder_id: null,
      uploaded_by: currentUserId,
      is_public: false,
    }).select('*, uploader:profiles!documents_uploaded_by_fkey(id, full_name, avatar_url)').single();

    if (newDoc) {
      await logActivity('uploaded_document', 'document', newDoc.id, { title: file.name });
      setProjectDocs(prev => [newDoc as any, ...prev]);
    }

    setDocUploading(false);
    e.target.value = '';
  };

  const handleDocDownload = async (doc: typeof projectDocs[0]) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDocDelete = async (doc: typeof projectDocs[0]) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    setProjectDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Budget ──────────────────────────────────────────────────────────────

  const handleCreateBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetForm.description.trim()) return;
    setSaving(true);

    const { data: newItem } = await supabase.from('budget_items').insert({
      type: budgetForm.type as any,
      description: budgetForm.description,
      amount: parseFloat(budgetForm.amount) || 0,
      donor_name: budgetForm.donor_name || null,
      date: budgetForm.date,
      category: budgetForm.category || null,
      notes: budgetForm.notes || null,
      project_id: projectId,
      receipt_url: null,
      created_by: currentUserId,
    }).select().single();

    if (newItem) {
      await logActivity('added_budget_item', 'budget', newItem.id, {
        title: budgetForm.description,
        amount: parseFloat(budgetForm.amount) || 0,
        type: budgetForm.type,
      });
      setBudgetItems(prev => [newItem as any, ...prev]);

      // Update project amount_raised if donation or grant
      if (budgetForm.type === 'donation' || budgetForm.type === 'grant') {
        const newRaised = (project?.amount_raised || 0) + (parseFloat(budgetForm.amount) || 0);
        await supabase.from('projects').update({ amount_raised: newRaised }).eq('id', projectId);
        setProject(prev => prev ? { ...prev, amount_raised: newRaised } : prev);
      }

      setBudgetForm({ type: 'donation', description: '', amount: '', donor_name: '', date: new Date().toISOString().split('T')[0], category: '', notes: '' });
      setShowBudgetForm(false);
    }
    setSaving(false);
  };

  const handleDeleteBudgetItem = async (item: typeof budgetItems[0]) => {
    if (!confirm(`Delete "${item.description}"?`)) return;
    await supabase.from('budget_items').delete().eq('id', item.id);
    setBudgetItems(prev => prev.filter(b => b.id !== item.id));

    // Adjust amount_raised
    if (item.type === 'donation' || item.type === 'grant') {
      const newRaised = Math.max(0, (project?.amount_raised || 0) - item.amount);
      await supabase.from('projects').update({ amount_raised: newRaised }).eq('id', projectId);
      setProject(prev => prev ? { ...prev, amount_raised: newRaised } : prev);
    }
  };

  const budgetSummary = () => {
    const income = budgetItems.filter(b => b.type === 'donation' || b.type === 'grant').reduce((s, b) => s + b.amount, 0);
    const expenses = budgetItems.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
    return { income, expenses, net: income - expenses };
  };

  // ── Team ────────────────────────────────────────────────────────────────

  const handleAddMember = async () => {
    if (!addMemberId) return;
    setSaving(true);

    const { data: newMem } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        profile_id: addMemberId,
        role: 'member',
        added_by: currentUserId,
      })
      .select('*, profile:profiles(*)')
      .single();

    if (newMem) {
      const profile = allProfiles.find(p => p.id === addMemberId);
      await logActivity('added_member', 'member', addMemberId, { name: profile?.full_name });
      setMembers(prev => [...prev, newMem as ProjectMemberRow]);
      setAddMemberId('');
      setShowAddMember(false);
    }
    setSaving(false);
  };

  const handleRemoveMember = async (memberId: string, profileName: string) => {
    if (!confirm(`Remove ${profileName} from this project?`)) return;
    await supabase.from('project_members').delete().eq('id', memberId);
    await logActivity('removed_member', 'member', memberId, { name: profileName });
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleChangeMemberRole = async (memberId: string, newRole: string) => {
    await supabase.from('project_members').update({ role: newRole }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getActivityLabel = (action: string) => {
    const labels: Record<string, string> = {
      created_message: 'posted a message',
      created_todo_group: 'created a to-do list',
      created_todo: 'added a to-do',
      completed_todo: 'completed a to-do',
      created_milestone: 'added a milestone',
      completed_milestone: 'completed a milestone',
      assigned_todo: 'assigned a to-do',
      set_due_date: 'set a due date',
      added_member: 'added a team member',
      removed_member: 'removed a team member',
      uploaded_document: 'uploaded a document',
      added_budget_item: 'added a budget item',
    };
    return labels[action] || action;
  };

  const todoStats = () => {
    let total = 0, done = 0;
    todoGroups.forEach(g => {
      g.todos?.forEach(t => { total++; if (t.is_completed) done++; });
    });
    return { total, done };
  };

  const milestoneStats = () => {
    const total = milestones.length;
    const done = milestones.filter(m => m.is_completed).length;
    return { total, done };
  };

  const availableMembers = allProfiles.filter(
    p => !members.some(m => m.profile_id === p.id)
  );

  const categoryColors: Record<string, string> = {
    general: 'bg-gray-100 text-gray-700',
    announcement: 'bg-blue-100 text-blue-700',
    question: 'bg-purple-100 text-purple-700',
    update: 'bg-green-100 text-green-700',
    fyi: 'bg-yellow-100 text-yellow-700',
  };

  // ── Loading / Error ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="card bg-red-50 border border-red-200">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Project not found</h3>
                <button onClick={() => router.push('/projects')} className="text-sm text-red-600 hover:underline mt-2">
                  Back to Projects
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const ts = todoStats();
  const ms = milestoneStats();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/projects')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="page-header">{project.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`badge ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
                  {project.status.replace('_', ' ')}
                </span>
                {(project as any).visibility === 'team' && (
                  <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Team only
                  </span>
                )}
                {project.category && (
                  <span className="text-sm text-gray-500">{project.category}</span>
                )}
                {project.lead && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Avatar src={project.lead.avatar_url} name={project.lead.full_name} size="sm" />
                    {project.lead.full_name}
                  </div>
                )}
              </div>
              {project.description && (
                <p className="text-gray-600 mt-3 max-w-2xl">{project.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-0 mb-6 border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'messages', label: 'Message Board', icon: MessageSquare },
            { key: 'todos', label: 'To-Dos', icon: CheckSquare },
            { key: 'milestones', label: 'Milestones', icon: Flag },
            { key: 'documents', label: 'Docs & Files', icon: FileText },
            { key: 'budget', label: 'Budget', icon: DollarSign },
            { key: 'team', label: 'Team', icon: Users },
            { key: 'activity', label: 'Activity', icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setCurrentView(tab.key as ProjectView)}
              className={`px-4 py-3 font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                currentView === tab.key || (currentView === 'message-detail' && tab.key === 'messages')
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════ OVERVIEW ═══════ */}
        {currentView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Message Board card */}
            <button onClick={() => setCurrentView('messages')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-100 p-2.5 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Message Board</h3>
                  <p className="text-sm text-gray-500">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {messages.slice(0, 2).map(m => (
                <p key={m.id} className="text-sm text-gray-600 truncate">{m.title}</p>
              ))}
              {messages.length === 0 && <p className="text-sm text-gray-400">No messages yet</p>}
            </button>

            {/* To-Dos card */}
            <button onClick={() => setCurrentView('todos')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-100 p-2.5 rounded-lg">
                  <CheckSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">To-Dos</h3>
                  <p className="text-sm text-gray-500">{ts.done}/{ts.total} completed</p>
                </div>
              </div>
              {ts.total > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${ts.total ? (ts.done / ts.total) * 100 : 0}%` }} />
                </div>
              )}
              {ts.total === 0 && <p className="text-sm text-gray-400">No to-dos yet</p>}
            </button>

            {/* Milestones card */}
            <button onClick={() => setCurrentView('milestones')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-purple-100 p-2.5 rounded-lg">
                  <Flag className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Milestones</h3>
                  <p className="text-sm text-gray-500">{ms.done}/{ms.total} completed</p>
                </div>
              </div>
              {milestones.slice(0, 2).map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  {m.is_completed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5 text-gray-300" />}
                  <span className={m.is_completed ? 'text-gray-400 line-through' : 'text-gray-600'}>{m.title}</span>
                </div>
              ))}
              {milestones.length === 0 && <p className="text-sm text-gray-400">No milestones yet</p>}
            </button>

            {/* Documents card */}
            <button onClick={() => setCurrentView('documents')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-cyan-100 p-2.5 rounded-lg">
                  <FileText className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Docs &amp; Files</h3>
                  <p className="text-sm text-gray-500">{projectDocs.length} document{projectDocs.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {projectDocs.slice(0, 3).map(doc => (
                <div key={doc.id} className="flex items-center gap-2 py-1 text-sm text-gray-600">
                  <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{doc.file_name}</span>
                </div>
              ))}
              {projectDocs.length === 0 && <p className="text-sm text-gray-400">No documents yet</p>}
            </button>

            {/* Budget card */}
            <button onClick={() => setCurrentView('budget')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-emerald-100 p-2.5 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Budget</h3>
                  <p className="text-sm text-gray-500">{budgetItems.length} transaction{budgetItems.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {project && project.budget_goal > 0 && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Raised: {formatCurrency(project.amount_raised)}</span>
                    <span>Goal: {formatCurrency(project.budget_goal)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (project.amount_raised / project.budget_goal) * 100)}%` }} />
                  </div>
                </div>
              )}
              {budgetItems.length === 0 && <p className="text-sm text-gray-400">No budget items yet</p>}
            </button>

            {/* Team card */}
            <button onClick={() => setCurrentView('team')} className="card hover:shadow-md transition-shadow text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-orange-100 p-2.5 rounded-lg">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Team</h3>
                  <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {members.slice(0, 6).map(m => (
                  <Avatar key={m.id} src={m.profile?.avatar_url} name={m.profile?.full_name || '?'} size="sm" className="ring-2 ring-white" />
                ))}
                {members.length > 6 && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 ring-2 ring-white">
                    +{members.length - 6}
                  </div>
                )}
              </div>
              {members.length === 0 && <p className="text-sm text-gray-400">No team members yet</p>}
            </button>

            {/* Activity card */}
            <button onClick={() => setCurrentView('activity')} className="card hover:shadow-md transition-shadow text-left lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-cyan-100 p-2.5 rounded-lg">
                  <Clock className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              </div>
              <div className="space-y-2">
                {activity.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Avatar src={a.actor?.avatar_url} name={a.actor?.full_name || '?'} size="sm" />
                    <span className="text-gray-700">
                      <strong>{a.actor?.full_name}</strong> {getActivityLabel(a.action)}
                      {a.metadata?.title && <span className="text-gray-500"> — {a.metadata.title}</span>}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatTimestamp(a.created_at)}</span>
                  </div>
                ))}
                {activity.length === 0 && <p className="text-sm text-gray-400">No activity yet</p>}
              </div>
            </button>
          </div>
        )}

        {/* ═══════ MESSAGE BOARD ═══════ */}
        {currentView === 'messages' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900">Message Board</h2>
              <button onClick={() => setShowMsgForm(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Message
              </button>
            </div>

            {/* New Message Form */}
            {showMsgForm && (
              <div className="card mb-6">
                <form onSubmit={handleCreateMessage} className="space-y-4">
                  <div>
                    <label className="label">Title</label>
                    <input className="input" required value={msgForm.title} onChange={e => setMsgForm(f => ({ ...f, title: e.target.value }))} placeholder="What's this about?" />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={msgForm.category} onChange={e => setMsgForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="general">General</option>
                      <option value="announcement">Announcement</option>
                      <option value="question">Question</option>
                      <option value="update">Update</option>
                      <option value="fyi">FYI</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Message</label>
                    <textarea className="input" rows={5} required value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your message..." />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Post Message
                    </button>
                    <button type="button" onClick={() => setShowMsgForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Message List */}
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className="card hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar src={msg.author?.avatar_url} name={msg.author?.full_name || '?'} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.is_pinned && <Pin className="w-3.5 h-3.5 text-blue-500" />}
                          <h3 className="font-semibold text-gray-900">{msg.title}</h3>
                          <span className={`badge text-xs ${categoryColors[msg.category] || categoryColors.general}`}>
                            {msg.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{msg.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{msg.author?.full_name}</span>
                          <span>{formatTimestamp(msg.created_at)}</span>
                          {(msg.comment_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> {msg.comment_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ MESSAGE DETAIL ═══════ */}
        {currentView === 'message-detail' && selectedMessage && (
          <div>
            <button
              onClick={() => { setCurrentView('messages'); setSelectedMessage(null); }}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Messages
            </button>

            <div className="card mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <Avatar src={selectedMessage.author?.avatar_url} name={selectedMessage.author?.full_name || '?'} size="md" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedMessage.title}</h2>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <span>{selectedMessage.author?.full_name}</span>
                      <span>&middot;</span>
                      <span>{formatTimestamp(selectedMessage.created_at)}</span>
                      <span className={`badge text-xs ${categoryColors[selectedMessage.category]}`}>{selectedMessage.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTogglePin(selectedMessage)} className="p-1.5 hover:bg-gray-100 rounded" title={selectedMessage.is_pinned ? 'Unpin' : 'Pin'}>
                    <Pin className={`w-4 h-4 ${selectedMessage.is_pinned ? 'text-blue-500' : 'text-gray-400'}`} />
                  </button>
                  {(selectedMessage.author_id === currentUserId || isAdmin) && (
                    <button onClick={() => handleDeleteMessage(selectedMessage.id)} className="p-1.5 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {selectedMessage.body}
              </div>
            </div>

            {/* Comments */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">
                Comments ({msgComments.length})
              </h3>
              <div className="space-y-4 mb-6">
                {msgComments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar src={c.author?.avatar_url} name={c.author?.full_name || '?'} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800">{c.author?.full_name}</span>
                        <span className="text-xs text-gray-400">{formatTimestamp(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                ))}
                {msgComments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                />
                <button onClick={handleAddComment} disabled={saving || !commentText.trim()} className="btn-primary flex items-center gap-1">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TO-DOS ═══════ */}
        {currentView === 'todos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900">To-Dos</h2>
              <button onClick={() => setShowTodoGroupForm(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> New List
              </button>
            </div>

            {showTodoGroupForm && (
              <div className="card mb-4">
                <form onSubmit={handleCreateTodoGroup} className="flex gap-3">
                  <input
                    className="input flex-1"
                    placeholder="Name this to-do list..."
                    required
                    value={todoGroupTitle}
                    onChange={e => setTodoGroupTitle(e.target.value)}
                  />
                  <button type="submit" disabled={saving} className="btn-primary">Create</button>
                  <button type="button" onClick={() => setShowTodoGroupForm(false)} className="btn-secondary">Cancel</button>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {todoGroups.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);
                const completed = group.todos?.filter(t => t.is_completed).length || 0;
                const total = group.todos?.length || 0;

                return (
                  <div key={group.id} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => toggleGroupCollapse(group.id)} className="flex items-center gap-2 font-semibold text-gray-900">
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {group.title}
                        <span className="text-sm font-normal text-gray-400">({completed}/{total})</span>
                      </button>
                      <button onClick={() => handleDeleteTodoGroup(group.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
                      </div>
                    )}

                    {!isCollapsed && (
                      <>
                        <div className="space-y-1">
                          {group.todos?.map(todo => {
                            const isExpanded = expandedTodoId === todo.id;
                            const isOverdue = todo.due_date && !todo.is_completed && new Date(todo.due_date) < new Date();
                            return (
                              <div key={todo.id} className={`rounded ${isExpanded ? 'bg-gray-50 ring-1 ring-gray-200' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3 py-1.5 px-2 group">
                                  <button onClick={() => handleToggleTodo(todo)} className="flex-shrink-0">
                                    {todo.is_completed
                                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                      : <Circle className="w-5 h-5 text-gray-300 hover:text-green-400" />}
                                  </button>
                                  <button
                                    onClick={() => setExpandedTodoId(isExpanded ? null : todo.id)}
                                    className={`flex-1 text-left text-sm ${todo.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                                  >
                                    {todo.title}
                                  </button>
                                  <div className="flex items-center gap-2">
                                    {todo.assignee && (
                                      <Avatar src={todo.assignee.avatar_url} name={todo.assignee.full_name} size="sm" />
                                    )}
                                    {todo.due_date && (
                                      <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                        {isOverdue && <AlertCircle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                                        {formatDate(todo.due_date)}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setExpandedTodoId(isExpanded ? null : todo.id)}
                                      className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                  <div className="px-10 pb-3 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Assignee</label>
                                        <select
                                          className="input !py-1.5 text-sm"
                                          value={todo.assignee_id || ''}
                                          onChange={e => handleUpdateTodoAssignee(todo, e.target.value || null)}
                                        >
                                          <option value="">Unassigned</option>
                                          {allProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.full_name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Due date</label>
                                        <input
                                          type="date"
                                          className="input !py-1.5 text-sm"
                                          value={todo.due_date || ''}
                                          onChange={e => handleUpdateTodoDueDate(todo, e.target.value || null)}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                                      <textarea
                                        className="input text-sm min-h-[60px] resize-none"
                                        placeholder="Add notes..."
                                        value={todo.notes || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setTodoGroups(prev => prev.map(g => ({
                                            ...g,
                                            todos: g.todos?.map(t => t.id === todo.id ? { ...t, notes: val } : t),
                                          })));
                                        }}
                                        onBlur={e => handleUpdateTodoNotes(todo, e.target.value)}
                                      />
                                    </div>
                                    <div className="flex justify-end">
                                      <button
                                        onClick={() => handleDeleteTodo(todo.id, group.id)}
                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add todo inline */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <input
                            className="input flex-1 !py-1.5 text-sm"
                            placeholder="Add a to-do..."
                            value={newTodoText[group.id] || ''}
                            onChange={e => setNewTodoText(prev => ({ ...prev, [group.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTodo(group.id); } }}
                          />
                          <button onClick={() => handleAddTodo(group.id)} className="btn-primary text-sm !py-1.5">Add</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {todoGroups.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No to-do lists yet. Create one to start tracking work!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ MILESTONES ═══════ */}
        {currentView === 'milestones' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900">Milestones</h2>
              <button onClick={() => setShowMilestoneForm(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Milestone
              </button>
            </div>

            {showMilestoneForm && (
              <div className="card mb-4">
                <form onSubmit={handleCreateMilestone} className="space-y-4">
                  <div>
                    <label className="label">Milestone Name</label>
                    <input className="input" required value={milestoneForm.title} onChange={e => setMilestoneForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea className="input" rows={2} value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Target Date</label>
                    <input type="date" className="input" value={milestoneForm.target_date} onChange={e => setMilestoneForm(f => ({ ...f, target_date: e.target.value }))} />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="btn-primary">Create</button>
                    <button type="button" onClick={() => setShowMilestoneForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {milestones.map(mil => (
                <div key={mil.id} className="card flex items-start gap-4">
                  <button onClick={() => handleToggleMilestone(mil)} className="mt-1 flex-shrink-0">
                    {mil.is_completed
                      ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                      : <Circle className="w-6 h-6 text-gray-300 hover:text-green-400" />}
                  </button>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${mil.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {mil.title}
                    </h3>
                    {mil.description && (
                      <p className="text-sm text-gray-500 mt-1">{mil.description}</p>
                    )}
                    {mil.target_date && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(mil.target_date)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {milestones.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Flag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No milestones yet. Add one to mark key dates!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ DOCUMENTS ═══════ */}
        {currentView === 'documents' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Docs &amp; Files</h2>
              <label className={`btn-primary flex items-center gap-2 cursor-pointer ${docUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {docUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {docUploading ? 'Uploading...' : 'Upload File'}
                <input type="file" className="hidden" onChange={handleDocUpload} disabled={docUploading} />
              </label>
            </div>

            {projectDocs.length > 0 ? (
              <div className="space-y-2">
                {projectDocs.map(doc => (
                  <div key={doc.id} className="card flex items-center gap-4">
                    <div className="bg-gray-100 p-2.5 rounded-lg flex-shrink-0">
                      <File className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                        <span>{formatDate(doc.created_at)}</span>
                        {doc.uploader && (
                          <span className="flex items-center gap-1">
                            <Avatar src={(doc.uploader as any).avatar_url} name={(doc.uploader as any).full_name} size="sm" />
                            {(doc.uploader as any).full_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDocDownload(doc)} className="p-2 text-gray-400 hover:text-primary rounded hover:bg-gray-50" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDocDelete(doc)} className="p-2 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-16 text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No documents yet</p>
                <p className="text-sm mt-1">Upload files to share with your team</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ BUDGET ═══════ */}
        {currentView === 'budget' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Budget</h2>
              <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Transaction
              </button>
            </div>

            {/* Summary cards */}
            {(() => {
              const summary = budgetSummary();
              return (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="card text-center">
                    <p className="text-sm text-gray-500">Income</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(summary.income)}</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-sm text-gray-500">Expenses</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(summary.expenses)}</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-sm text-gray-500">Net</p>
                    <p className={`text-xl font-bold ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summary.net)}</p>
                  </div>
                </div>
              );
            })()}

            {/* Budget goal progress */}
            {project && project.budget_goal > 0 && (
              <div className="card mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Fundraising Progress</span>
                  <span>{formatCurrency(project.amount_raised)} / {formatCurrency(project.budget_goal)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, (project.amount_raised / project.budget_goal) * 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{Math.round((project.amount_raised / project.budget_goal) * 100)}% of goal</p>
              </div>
            )}

            {/* Add form */}
            {showBudgetForm && (
              <div className="card mb-4">
                <form onSubmit={handleCreateBudgetItem} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                      <select className="input" value={budgetForm.type} onChange={e => setBudgetForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="donation">Donation</option>
                        <option value="grant">Grant</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Amount ($)</label>
                      <input className="input" type="number" min="0" step="0.01" required value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Description *</label>
                    <input className="input" required value={budgetForm.description} onChange={e => setBudgetForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
                      <input className="input" type="date" value={budgetForm.date} onChange={e => setBudgetForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Donor / Source</label>
                      <input className="input" value={budgetForm.donor_name} onChange={e => setBudgetForm(f => ({ ...f, donor_name: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                    <textarea className="input min-h-[60px] resize-none" value={budgetForm.notes} onChange={e => setBudgetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
                    </button>
                    <button type="button" onClick={() => setShowBudgetForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Transactions list */}
            {budgetItems.length > 0 ? (
              <div className="space-y-2">
                {budgetItems.map(item => {
                  const isIncome = item.type === 'donation' || item.type === 'grant';
                  return (
                    <div key={item.id} className="card flex items-center gap-4">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
                        <DollarSign className={`w-5 h-5 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{item.description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span className="capitalize">{item.type}</span>
                          <span>{formatDate(item.date)}</span>
                          {item.donor_name && <span>{item.donor_name}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteBudgetItem(item)} className="p-2 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card text-center py-16 text-gray-400">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm mt-1">Add donations, grants, and expenses to track your budget</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TEAM ═══════ */}
        {currentView === 'team' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900">Team ({members.length})</h2>
              <button onClick={() => setShowAddMember(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>

            {showAddMember && (
              <div className="card mb-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="label">Select Member</label>
                    <select className="input" value={addMemberId} onChange={e => setAddMemberId(e.target.value)}>
                      <option value="">Choose a person...</option>
                      {availableMembers.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleAddMember} disabled={!addMemberId || saving} className="btn-primary">Add</button>
                  <button onClick={() => { setShowAddMember(false); setAddMemberId(''); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {members.map(mem => (
                <div key={mem.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={mem.profile?.avatar_url} name={mem.profile?.full_name || '?'} size="md" />
                    <div>
                      <p className="font-medium text-gray-900">{mem.profile?.full_name}</p>
                      <p className="text-sm text-gray-500">{mem.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="input !py-1.5 text-sm !w-auto"
                      value={mem.role}
                      onChange={e => handleChangeMemberRole(mem.id, e.target.value)}
                    >
                      <option value="lead">Lead</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(mem.id, mem.profile?.full_name || 'this member')}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No team members yet. Add people to this project!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ ACTIVITY ═══════ */}
        {currentView === 'activity' && (
          <div>
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Activity</h2>
            <div className="card">
              <div className="space-y-4">
                {activity.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <Avatar src={a.actor?.avatar_url} name={a.actor?.full_name || '?'} size="sm" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        <strong>{a.actor?.full_name}</strong> {getActivityLabel(a.action)}
                        {a.metadata?.title && <span className="text-gray-500"> — {a.metadata.title}</span>}
                        {a.metadata?.name && <span className="text-gray-500"> — {a.metadata.name}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTimestamp(a.created_at)}</p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No activity yet. Actions in this project will show up here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
