'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, statusColors } from '@/lib/utils';
import type { Project, Profile } from '@/lib/database.types';
import { Plus, Loader2, FolderKanban, X, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

type ProjectWithLead = Project & { lead?: Profile | null };

const statusOptions = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const categoryOptions = ['Academic', 'Arts', 'Athletics', 'STEM', 'Community', 'Scholarships', 'Other'];

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithLead[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<ProjectWithLead | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', status: 'planning', category: '',
    budget_goal: '', start_date: '', end_date: '', lead_id: '',
  });

  const fetchData = async () => {
    const [{ data: proj }, { data: mem }] = await Promise.all([
      supabase.from('projects').select('*, lead:profiles(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ]);
    setProjects((proj as ProjectWithLead[]) || []);
    setMembers(mem || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditProject(null);
    setForm({ title: '', description: '', status: 'planning', category: '', budget_goal: '', start_date: '', end_date: '', lead_id: '' });
    setShowForm(true);
  };

  const openEdit = (p: ProjectWithLead) => {
    setEditProject(p);
    setForm({
      title: p.title, description: p.description || '', status: p.status,
      category: p.category || '', budget_goal: p.budget_goal?.toString() || '',
      start_date: p.start_date || '', end_date: p.end_date || '', lead_id: p.lead_id || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title, description: form.description || null,
      status: form.status as Project['status'], category: form.category || null,
      budget_goal: parseFloat(form.budget_goal) || 0,
      start_date: form.start_date || null, end_date: form.end_date || null,
      lead_id: form.lead_id || null, created_by: user?.id || null,
      amount_raised: editProject?.amount_raised ?? 0,
    };
    if (editProject) {
      await supabase.from('projects').update(payload).eq('id', editProject.id);
    } else {
      await supabase.from('projects').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    await supabase.from('projects').delete().eq('id', id);
    fetchData();
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Projects</h1>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="card hover:shadow-md transition-shadow relative">
                {/* Edit/Delete buttons */}
                <div className="absolute top-4 right-4 flex gap-1 z-10">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(p); }} className="p-1 text-gray-400 hover:text-primary rounded bg-white/80">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id); }} className="p-1 text-gray-400 hover:text-red-500 rounded bg-white/80">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link href={`/projects/${p.id}`} className="block">
                  <div className="mb-3">
                    <span className={`badge ${statusColors[p.status] || 'bg-gray-100 text-gray-700'}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                  {p.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
                  {p.category && <p className="text-xs text-gray-400 mb-3">{p.category}</p>}

                  {/* Budget progress */}
                  {p.budget_goal > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Raised: {formatCurrency(p.amount_raised)}</span>
                        <span>Goal: {formatCurrency(p.budget_goal)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-accent h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (p.amount_raised / p.budget_goal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      {(p as any).lead ? (
                        <>
                          <Avatar src={(p as any).lead.avatar_url} name={(p as any).lead.full_name} size="sm" />
                          {(p as any).lead.full_name}
                        </>
                      ) : 'No lead assigned'}
                    </span>
                    {p.end_date && <span>Due {formatDate(p.end_date)}</span>}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">{editProject ? 'Edit Project' : 'New Project'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="label">Title *</label>
                  <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[80px] resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Select...</option>
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Budget Goal ($)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.budget_goal} onChange={e => setForm(f => ({ ...f, budget_goal: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start Date</label>
                    <input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Project Lead</label>
                  <select className="input" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
                    <option value="">Select member...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editProject ? 'Save Changes' : 'Create Project'}
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
