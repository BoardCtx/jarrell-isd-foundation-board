'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { BudgetItem, Project } from '@/lib/database.types';
import { Plus, Loader2, DollarSign, X, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

type BudgetWithProject = BudgetItem & { project?: Project | null };

const typeOptions = ['donation', 'grant', 'expense', 'transfer'];
const categoryOptions = ['General Operating', 'Scholarships', 'Program Funding', 'Events', 'Administration', 'Equipment', 'Other'];

export default function BudgetPage() {
  const supabase = createClient();
  const [items, setItems] = useState<BudgetWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BudgetWithProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({
    type: 'donation', description: '', amount: '', donor_name: '',
    date: new Date().toISOString().split('T')[0], category: '', notes: '', project_id: '',
  });

  const fetchData = async () => {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from('budget_items').select('*, project:projects(*)').order('date', { ascending: false }),
      supabase.from('projects').select('*').order('title'),
    ]);
    setItems((b as BudgetWithProject[]) || []);
    setProjects(p || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const income = items.filter(i => ['donation', 'grant'].includes(i.type)).reduce((s, i) => s + i.amount, 0);
  const expenses = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const balance = income - expenses;

  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);

  const openNew = () => {
    setEditItem(null);
    setForm({ type: 'donation', description: '', amount: '', donor_name: '', date: new Date().toISOString().split('T')[0], category: '', notes: '', project_id: '' });
    setShowForm(true);
  };

  const openEdit = (item: BudgetWithProject) => {
    setEditItem(item);
    setForm({
      type: item.type, description: item.description, amount: item.amount.toString(),
      donor_name: item.donor_name || '', date: item.date, category: item.category || '',
      notes: item.notes || '', project_id: item.project_id || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      type: form.type as BudgetItem['type'], description: form.description,
      amount: parseFloat(form.amount), donor_name: form.donor_name || null,
      date: form.date, category: form.category || null, notes: form.notes || null,
      project_id: form.project_id || null, created_by: user?.id || null,
    };
    if (editItem) {
      await supabase.from('budget_items').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('budget_items').insert(payload);
      // Update project amount_raised if it's a donation/grant tied to a project
      if (['donation', 'grant'].includes(form.type) && form.project_id) {
        const { data: proj } = await supabase.from('projects').select('amount_raised').eq('id', form.project_id).single();
        if (proj) {
          await supabase.from('projects').update({ amount_raised: (proj.amount_raised || 0) + parseFloat(form.amount) }).eq('id', form.project_id);
        }
      }
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('budget_items').delete().eq('id', id);
    fetchData();
  };

  const typeColor: Record<string, string> = {
    donation: 'text-green-600 bg-green-50',
    grant: 'text-blue-600 bg-blue-50',
    expense: 'text-red-600 bg-red-50',
    transfer: 'text-purple-600 bg-purple-50',
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Financial</h1>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card bg-green-50 border-green-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2.5 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-green-700">Total Income</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(income)}</p>
              </div>
            </div>
          </div>
          <div className="card bg-red-50 border-red-100">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2.5 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-red-700">Total Expenses</p>
                <p className="text-xl font-bold text-red-800">{formatCurrency(expenses)}</p>
              </div>
            </div>
          </div>
          <div className={`card ${balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <DollarSign className={`w-5 h-5 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className={`text-sm ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Balance</p>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{formatCurrency(balance)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['all', ...typeOptions].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === t ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Type', 'Description', 'Donor/Source', 'Project', 'Category', 'Amount', ''].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No entries found</td></tr>
                ) : filtered.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">{formatDate(item.date)}</td>
                    <td className="table-cell">
                      <span className={`badge ${typeColor[item.type]}`}>{item.type}</span>
                    </td>
                    <td className="table-cell font-medium max-w-[200px] truncate">{item.description}</td>
                    <td className="table-cell">{item.donor_name || '—'}</td>
                    <td className="table-cell">{item.project?.title || '—'}</td>
                    <td className="table-cell">{item.category || '—'}</td>
                    <td className={`table-cell font-semibold ${['donation', 'grant'].includes(item.type) ? 'text-green-700' : 'text-red-700'}`}>
                      {['donation', 'grant'].includes(item.type) ? '+' : '-'}{formatCurrency(item.amount)}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                <h2 className="font-semibold text-lg">{editItem ? 'Edit Entry' : 'Add Financial Entry'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Type *</label>
                    <select className="input" required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date *</label>
                    <input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Description *</label>
                  <input className="input" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Amount ($) *</label>
                  <input className="input" type="number" required min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                {['donation', 'grant'].includes(form.type) && (
                  <div>
                    <label className="label">Donor / Source Name</label>
                    <input className="input" value={form.donor_name} onChange={e => setForm(f => ({ ...f, donor_name: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="label">Project (optional)</label>
                  <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select...</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input resize-none min-h-[64px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editItem ? 'Save Changes' : 'Add Entry'}
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
