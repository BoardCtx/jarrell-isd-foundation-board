'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, statusColors } from '@/lib/utils';
import type { Task, Profile, Project } from '@/lib/database.types';
import {
  Plus, Loader2, CheckSquare, X, Pencil, Trash2, Check, MessageSquare,
  Paperclip, Upload, Send, Users, User, Eye, EyeOff, ChevronDown, ChevronRight,
  FileText, Download,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskAssignee {
  id: string;
  task_id: string;
  profile_id: string;
  profile?: { id: string; full_name: string; email: string };
}

interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string };
}

interface TaskDoc {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  uploader?: { id: string; full_name: string };
}

interface GroupWithMembers {
  id: string;
  name: string;
  members: { profile_id: string; profile: { id: string; full_name: string; email: string } }[];
}

type TaskWithRels = Task & {
  assignee?: Profile | null;
  project?: Project | null;
  task_assignees?: TaskAssignee[];
};

const statusList = ['todo', 'in_progress', 'review', 'done'];
const priorityList = ['low', 'medium', 'high', 'urgent'];

const kanbanColumns = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRels[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<TaskWithRels | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  // Current user info
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filter: 'all' | 'mine'
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');

  // Task detail panel
  const [selectedTask, setSelectedTask] = useState<TaskWithRels | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskDocs, setTaskDocs] = useState<TaskDoc[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskAssignee[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    project_id: '', due_date: '',
  });
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);
  const [addAssigneeId, setAddAssigneeId] = useState('');

  // ── Fetch Data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(prof?.role === 'admin' || prof?.role === 'president');
    }

    const [{ data: t }, { data: m }, { data: p }, { data: g }, { data: ta }] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles(*), project:projects(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('projects').select('*').in('status', ['planning', 'active']).order('title'),
      supabase.from('groups').select('id, name, group_members(profile_id, profile:profiles(id, full_name, email))'),
      supabase.from('task_assignees').select('id, task_id, profile_id, profiles:profile_id(id, full_name, email)'),
    ]);

    // Merge assignees into tasks
    const assigneeMap: Record<string, TaskAssignee[]> = {};
    for (const a of (ta || [])) {
      if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
      assigneeMap[a.task_id].push({
        id: a.id,
        task_id: a.task_id,
        profile_id: a.profile_id,
        profile: (a as any).profiles || undefined,
      });
    }

    const tasksWithAssignees = ((t as TaskWithRels[]) || []).map(task => ({
      ...task,
      task_assignees: assigneeMap[task.id] || [],
    }));

    setTasks(tasksWithAssignees);
    setMembers(m || []);
    setProjects(p || []);
    setGroups((g || []).map((gr: any) => ({
      id: gr.id,
      name: gr.name,
      members: (gr.group_members || []).map((gm: any) => ({
        profile_id: gm.profile_id,
        profile: gm.profile,
      })),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filter tasks ────────────────────────────────────────────────────────────

  const filteredTasks = filterMode === 'all'
    ? tasks
    : tasks.filter(t =>
        t.created_by === currentUserId ||
        t.assignee_id === currentUserId ||
        (t.task_assignees || []).some(a => a.profile_id === currentUserId)
      );

  // ── Task Detail Loading ─────────────────────────────────────────────────────

  const openTaskDetail = async (task: TaskWithRels) => {
    setSelectedTask(task);
    setCommentText('');

    // Fetch comments, docs, and assignees for this task
    const [{ data: comments }, { data: docs }, { data: assigns }] = await Promise.all([
      supabase
        .from('task_comments')
        .select('*, author:profiles!task_comments_author_id_fkey(id, full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('task_documents')
        .select('*, uploader:profiles!task_documents_uploaded_by_fkey(id, full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_assignees')
        .select('*, profile:profiles!task_assignees_profile_id_fkey(id, full_name, email)')
        .eq('task_id', task.id),
    ]);

    setTaskComments((comments || []).map((c: any) => ({ ...c, author: c.author })));
    setTaskDocs((docs || []).map((d: any) => ({ ...d, uploader: d.uploader })));
    setTaskAssignees((assigns || []).map((a: any) => ({ ...a, profile: a.profile })));
  };

  // ── Form Handlers ───────────────────────────────────────────────────────────

  const openNew = () => {
    setEditTask(null);
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', project_id: '', due_date: '' });
    setFormAssigneeIds([]);
    setAddAssigneeId('');
    setShowForm(true);
  };

  const openEdit = (t: TaskWithRels) => {
    setEditTask(t);
    setForm({
      title: t.title, description: t.description || '', status: t.status,
      priority: t.priority, project_id: t.project_id || '', due_date: t.due_date || '',
    });
    setFormAssigneeIds((t.task_assignees || []).map(a => a.profile_id));
    setAddAssigneeId('');
    setShowForm(true);
  };

  const addFormAssignee = (profileId: string) => {
    if (profileId && !formAssigneeIds.includes(profileId)) {
      setFormAssigneeIds(prev => [...prev, profileId]);
    }
    setAddAssigneeId('');
  };

  const addGroupToForm = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newIds = group.members
      .map(m => m.profile_id)
      .filter(id => !formAssigneeIds.includes(id));
    setFormAssigneeIds(prev => [...prev, ...newIds]);
  };

  const removeFormAssignee = (profileId: string) => {
    setFormAssigneeIds(prev => prev.filter(id => id !== profileId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title, description: form.description || null,
      status: form.status as Task['status'], priority: form.priority as Task['priority'],
      assignee_id: formAssigneeIds[0] || null, // keep legacy single assignee for backwards compat
      project_id: form.project_id || null,
      due_date: form.due_date || null, created_by: user?.id || null,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
    };

    let taskId: string;

    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id);
      taskId = editTask.id;
    } else {
      const { data: newTask } = await supabase.from('tasks').insert(payload).select('id').single();
      taskId = newTask?.id || '';
    }

    if (taskId) {
      // Sync assignees: delete old, insert new
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (formAssigneeIds.length > 0) {
        await supabase.from('task_assignees').insert(
          formAssigneeIds.map(pid => ({
            task_id: taskId,
            profile_id: pid,
            assigned_by: user?.id || null,
          }))
        );
      }
    }

    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    if (selectedTask?.id === id) setSelectedTask(null);
    fetchData();
  };

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', taskId);
    fetchData();
  };

  // ── Comment Handlers ────────────────────────────────────────────────────────

  const addComment = async () => {
    if (!selectedTask || !commentText.trim()) return;
    setSendingComment(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: newComment } = await supabase
      .from('task_comments')
      .insert({ task_id: selectedTask.id, author_id: user?.id || '', body: commentText.trim() })
      .select('*, author:profiles!task_comments_author_id_fkey(id, full_name)')
      .single();

    if (newComment) {
      setTaskComments(prev => [...prev, { ...newComment, author: (newComment as any).author }]);
      setCommentText('');

      // Send notification in background
      fetch('/api/tasks/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          type: 'comment',
          commentBody: commentText.trim(),
        }),
      }).catch(() => {}); // fire and forget
    }

    setSendingComment(false);
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('task_comments').delete().eq('id', commentId);
    setTaskComments(prev => prev.filter(c => c.id !== commentId));
  };

  // ── Document Handlers ───────────────────────────────────────────────────────

  const uploadDocument = async (file: File) => {
    if (!selectedTask) return;
    setUploadingDoc(true);
    const { data: { user } } = await supabase.auth.getUser();

    const filePath = `${selectedTask.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('task-documents')
      .upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploadingDoc(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('task-documents').getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl || '';

    const { data: newDoc } = await supabase
      .from('task_documents')
      .insert({
        task_id: selectedTask.id,
        uploaded_by: user?.id || '',
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
      })
      .select('*, uploader:profiles!task_documents_uploaded_by_fkey(id, full_name)')
      .single();

    if (newDoc) {
      setTaskDocs(prev => [{ ...newDoc, uploader: (newDoc as any).uploader }, ...prev]);

      // Send notification in background
      fetch('/api/tasks/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          type: 'document',
          documentName: file.name,
          documentUrl: publicUrl,
        }),
      }).catch(() => {});
    }

    setUploadingDoc(false);
  };

  const deleteDocument = async (doc: TaskDoc) => {
    await supabase.storage.from('task-documents').remove([doc.file_path]);
    await supabase.from('task_documents').delete().eq('id', doc.id);
    setTaskDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const downloadDocument = async (doc: TaskDoc) => {
    const { data } = await supabase.storage.from('task-documents').download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Assignee management on detail panel ─────────────────────────────────────

  const addAssigneeToTask = async (profileId: string) => {
    if (!selectedTask) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('task_assignees')
      .insert({ task_id: selectedTask.id, profile_id: profileId, assigned_by: user?.id || null })
      .select('*, profile:profiles!task_assignees_profile_id_fkey(id, full_name, email)')
      .single();
    if (data) {
      setTaskAssignees(prev => [...prev, { ...data, profile: (data as any).profile }]);
    }
  };

  const removeAssigneeFromTask = async (assigneeId: string) => {
    await supabase.from('task_assignees').delete().eq('id', assigneeId);
    setTaskAssignees(prev => prev.filter(a => a.id !== assigneeId));
  };

  const addGroupToTask = async (groupId: string) => {
    if (!selectedTask) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const { data: { user } } = await supabase.auth.getUser();
    const existingIds = new Set(taskAssignees.map(a => a.profile_id));
    const newMembers = group.members.filter(m => !existingIds.has(m.profile_id));

    if (newMembers.length === 0) return;

    const { data } = await supabase
      .from('task_assignees')
      .insert(newMembers.map(m => ({
        task_id: selectedTask.id,
        profile_id: m.profile_id,
        assigned_by: user?.id || null,
      })))
      .select('*, profile:profiles!task_assignees_profile_id_fkey(id, full_name, email)');

    if (data) {
      setTaskAssignees(prev => [
        ...prev,
        ...data.map((a: any) => ({ ...a, profile: a.profile })),
      ]);
    }
  };

  // ── Helper: assignee names ──────────────────────────────────────────────────

  const getAssigneeNames = (task: TaskWithRels) => {
    const names = (task.task_assignees || [])
      .map(a => a.profile?.full_name)
      .filter(Boolean);
    if (names.length === 0 && task.assignee) return [task.assignee.full_name];
    return names;
  };

  const formatAssignees = (task: TaskWithRels) => {
    const names = getAssigneeNames(task);
    if (names.length === 0) return null;
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // ── Task Card ───────────────────────────────────────────────────────────────

  const TaskCard = ({ task }: { task: TaskWithRels }) => (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => openTaskDetail(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 leading-tight">{task.title}</p>
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(task)} className="p-0.5 text-gray-400 hover:text-primary">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDelete(task.id)} className="p-0.5 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {task.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge ${statusColors[task.priority] || 'bg-gray-100 text-gray-600'}`}>
          {task.priority}
        </span>
        {task.due_date && (
          <span className="text-xs text-gray-400">Due {formatDate(task.due_date)}</span>
        )}
      </div>
      {formatAssignees(task) && (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <Users className="w-3 h-3" /> {formatAssignees(task)}
        </p>
      )}
      {task.project && (
        <p className="text-xs text-primary/60 mt-1">{task.project.title}</p>
      )}
      {task.status !== 'done' && (
        <button
          onClick={(e) => { e.stopPropagation(); moveTask(task.id, statusList[statusList.indexOf(task.status) + 1] as Task['status'] || 'done'); }}
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          {task.status === 'review' ? 'Mark done' : 'Move forward'}
        </button>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Tasks</h1>
          <div className="flex items-center gap-3">
            {/* Filter toggle */}
            {(isAdmin || true) && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${filterMode === 'all' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Eye className="w-3.5 h-3.5" /> All Tasks
                </button>
                <button
                  onClick={() => setFilterMode('mine')}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${filterMode === 'mine' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <User className="w-3.5 h-3.5" /> My Tasks
                </button>
              </div>
            )}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm ${view === 'kanban' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Kanban</button>
              <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>List</button>
            </div>
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Task
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : view === 'kanban' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kanbanColumns.map((col) => {
              const colTasks = filteredTasks.filter(t => t.status === col.key);
              return (
                <div key={col.key} className="bg-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                    <span className="bg-white text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Task', 'Status', 'Priority', 'Assignees', 'Project', 'Due Date', ''].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No tasks yet</td></tr>
                ) : filteredTasks.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTaskDetail(t)}>
                    <td className="table-cell font-medium">{t.title}</td>
                    <td className="table-cell"><span className={`badge ${statusColors[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                    <td className="table-cell"><span className={`badge ${statusColors[t.priority]}`}>{t.priority}</span></td>
                    <td className="table-cell">{formatAssignees(t) || '—'}</td>
                    <td className="table-cell">{t.project?.title || '—'}</td>
                    <td className="table-cell">{formatDate(t.due_date)}</td>
                    <td className="table-cell" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── New/Edit Task Modal ──────────────────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">{editTask ? 'Edit Task' : 'New Task'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="label">Title *</label>
                  <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input resize-none min-h-[72px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {statusList.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      {priorityList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Assignees ──────────────────────────────────────────────── */}
                <div>
                  <label className="label">Assign To</label>
                  <div className="flex gap-2 mb-2">
                    <select className="input flex-1" value={addAssigneeId} onChange={e => setAddAssigneeId(e.target.value)}>
                      <option value="">Select a member...</option>
                      {members.filter(m => !formAssigneeIds.includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addFormAssignee(addAssigneeId)}
                      disabled={!addAssigneeId}
                      className="btn-primary !py-1.5 !px-3 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Add group */}
                  {groups.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      <select id="taskGroupSelect" className="input flex-1 text-sm" defaultValue="">
                        <option value="">Add a group...</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({g.members?.length || 0} members)</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const sel = document.getElementById('taskGroupSelect') as HTMLSelectElement;
                          if (sel.value) { addGroupToForm(sel.value); sel.value = ''; }
                        }}
                        className="btn-secondary !py-1.5 !px-3 flex items-center gap-1"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {/* Assignee chips */}
                  {formAssigneeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formAssigneeIds.map(id => {
                        const m = members.find(p => p.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">
                            {m?.full_name || 'Unknown'}
                            <button type="button" onClick={() => removeFormAssignee(id)} className="text-blue-400 hover:text-blue-700">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Project</label>
                  <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editTask ? 'Save Changes' : 'Create Task'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Task Detail Slide-out Panel ──────────────────────────────────────── */}
        {selectedTask && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedTask(null)} />
            <div className="relative w-full max-w-xl bg-white shadow-xl flex flex-col">
              {/* Header */}
              <div className="p-5 border-b flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg text-gray-900">{selectedTask.title}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`badge ${statusColors[selectedTask.status]}`}>{selectedTask.status.replace('_', ' ')}</span>
                    <span className={`badge ${statusColors[selectedTask.priority]}`}>{selectedTask.priority}</span>
                    {selectedTask.due_date && <span className="text-xs text-gray-400">Due {formatDate(selectedTask.due_date)}</span>}
                  </div>
                  {selectedTask.description && (
                    <p className="text-sm text-gray-500 mt-2">{selectedTask.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(selectedTask)} className="p-1.5 text-gray-400 hover:text-primary rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSelectedTask(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* Assignees section */}
                <div className="p-5 border-b">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Assignees ({taskAssignees.length})
                  </h3>
                  <div className="space-y-1">
                    {taskAssignees.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 group">
                        <span className="text-sm text-gray-700">{a.profile?.full_name || 'Unknown'}</span>
                        <button onClick={() => removeAssigneeFromTask(a.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {taskAssignees.length === 0 && <p className="text-xs text-gray-400">No one assigned yet.</p>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <select
                      className="input flex-1 text-sm !py-1.5"
                      defaultValue=""
                      onChange={e => { if (e.target.value) { addAssigneeToTask(e.target.value); e.target.value = ''; } }}
                    >
                      <option value="">Add person...</option>
                      {members.filter(m => !taskAssignees.some(a => a.profile_id === m.id)).map(m => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                    {groups.length > 0 && (
                      <select
                        className="input w-36 text-sm !py-1.5"
                        defaultValue=""
                        onChange={e => { if (e.target.value) { addGroupToTask(e.target.value); e.target.value = ''; } }}
                      >
                        <option value="">Add group...</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Documents section */}
                <div className="p-5 border-b">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> Documents ({taskDocs.length})
                  </h3>
                  <div className="space-y-1.5">
                    {taskDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-gray-700 truncate">{doc.file_name}</p>
                            <p className="text-xs text-gray-400">{doc.uploader?.full_name} &middot; {formatTimestamp(doc.created_at)} {doc.file_size ? `· ${formatFileSize(doc.file_size)}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => downloadDocument(doc)} className="p-1 text-gray-400 hover:text-blue-600" title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteDocument(doc)} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {taskDocs.length === 0 && <p className="text-xs text-gray-400">No documents uploaded yet.</p>}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer py-1.5 px-2 rounded hover:bg-blue-50 transition-colors w-fit">
                    {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingDoc ? 'Uploading...' : 'Upload document'}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploadingDoc}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadDocument(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-1 px-2">All assigned users will be emailed when a document is uploaded.</p>
                </div>

                {/* Comments section */}
                <div className="p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Comments ({taskComments.length})
                  </h3>
                  <div className="space-y-3 mb-4">
                    {taskComments.map(c => (
                      <div key={c.id} className="group">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-800">{c.author?.full_name || 'Unknown'}</span>
                          <span className="text-xs text-gray-400">{formatTimestamp(c.created_at)}</span>
                          {c.author_id === currentUserId && (
                            <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                    {taskComments.length === 0 && (
                      <p className="text-xs text-gray-400">No comments yet. Be the first to comment.</p>
                    )}
                  </div>

                  {/* Comment input */}
                  <div className="flex gap-2">
                    <textarea
                      className="input flex-1 text-sm resize-none min-h-[60px]"
                      placeholder="Write a comment... (all assignees will be notified)"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          addComment();
                        }
                      }}
                    />
                    <button
                      onClick={addComment}
                      disabled={!commentText.trim() || sendingComment}
                      className="self-end btn-primary !py-2 !px-3 disabled:opacity-50"
                    >
                      {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Press Ctrl+Enter to send</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
