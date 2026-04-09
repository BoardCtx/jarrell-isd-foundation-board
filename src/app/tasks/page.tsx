'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, statusColors } from '@/lib/utils';
import type { Task, Profile, Project } from '@/lib/database.types';
import { Plus, Loader2, CheckSquare, X, Pencil, Trash2, Check } from 'lucide-react';

type TaskWithRels = Task & { assignee?: Profile | null; project?: Project | null };

const statusList = ['todo', 'in_progress', 'review', 'done'];
const priorityList = ['low', 'medium', 'high', 'urgent'];

const kanbanColumns = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRels[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<TaskWithRels | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    assignee_id: '', project_id: '', due_date: '',
  });

  const fetchData = async () => {
    const [{ data: t }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles(*), project:projects(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('projects').select('*').in('status', ['planning', 'active']).order('title'),
    ]);
    setTasks((t as TaskWithRels[]) || []);
    setMembers(m || []);
    setProjects(p || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditTask(null);
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', assignee_id: '', project_id: '', due_date: '' });
    setShowForm(true);
  };

  const openEdit = (t: TaskWithRels) => {
    setEditTask(t);
    setForm({
      title: t.title, description: t.description || '', status: t.status,
      priority: t.priority, assignee_id: t.assignee_id || '',
      project_id: t.project_id || '', due_date: t.due_date || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title, description: form.description || null,
      status: form.status as Task['status'], priority: form.priority as Task['priority'],
      assignee_id: form.assignee_id || null, project_id: form.project_id || null,
      due_date: form.due_date || null, created_by: user?.id || null,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
    };
    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id);
    } else {
      await supabase.from('tasks').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    fetchData();
  };

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', taskId);
    fetchData();
  };

  const TaskCard = ({ task }: { task: TaskWithRels }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 leading-tight">{task.title}</p>
        <div className="flex gap-1 flex-shrink-0">
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
      {task.assignee && (
        <p className="text-xs text-gray-400 mt-1.5">{task.assignee.full_name}</p>
      )}
      {task.project && (
        <p className="text-xs text-primary/60 mt-1">{task.project.title}</p>
      )}
      {task.status !== 'done' && (
        <button
          onClick={() => moveTask(task.id, statusList[statusList.indexOf(task.status) + 1] as Task['status'] || 'done')}
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          {task.status === 'review' ? 'Mark done' : 'Move forward'}
        </button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Tasks</h1>
          <div className="flex items-center gap-3">
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
              const colTasks = tasks.filter(t => t.status === col.key);
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
                  {['Task', 'Status', 'Priority', 'Assignee', 'Project', 'Due Date', ''].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No tasks yet</td></tr>
                ) : tasks.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{t.title}</td>
                    <td className="table-cell"><span className={`badge ${statusColors[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                    <td className="table-cell"><span className={`badge ${statusColors[t.priority]}`}>{t.priority}</span></td>
                    <td className="table-cell">{t.assignee?.full_name || '—'}</td>
                    <td className="table-cell">{t.project?.title || '—'}</td>
                    <td className="table-cell">{formatDate(t.due_date)}</td>
                    <td className="table-cell">
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

        {/* Modal */}
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
                <div>
                  <label className="label">Assign To</label>
                  <select className="input" value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
                    <option value="">Select member...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
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
      </div>
    </AppLayout>
  );
}
