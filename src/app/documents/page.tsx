'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { Document, Project, Meeting } from '@/lib/database.types';
import { Plus, Loader2, FileText, X, Trash2, Download, Search, FolderOpen } from 'lucide-react';

type DocWithRels = Document & { project?: Project | null; meeting?: Meeting | null };

const categoryOptions = ['agenda', 'minutes', 'financial', 'policy', 'grant', 'general', 'other'];
const categoryColors: Record<string, string> = {
  agenda: 'bg-blue-100 text-blue-700',
  minutes: 'bg-green-100 text-green-700',
  financial: 'bg-yellow-100 text-yellow-700',
  policy: 'bg-purple-100 text-purple-700',
  grant: 'bg-orange-100 text-orange-700',
  general: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-700',
};
const categoryIcons: Record<string, string> = {
  agenda: '📋', minutes: '📝', financial: '💰', policy: '📜', grant: '🏆', general: '📄', other: '📎',
};

export default function DocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<DocWithRels[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', project_id: '', meeting_id: '' });

  const fetchData = async () => {
    const [{ data: d }, { data: p }, { data: m }] = await Promise.all([
      supabase.from('documents').select('*, project:projects(*), meeting:meetings(*)').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('title'),
      supabase.from('meetings').select('*').order('date', { ascending: false }).limit(20),
    ]);
    setDocs((d as DocWithRels[]) || []);
    setProjects(p || []);
    setMeetings(m || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Please select a file'); return; }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const filePath = `${user?.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    await supabase.from('documents').insert({
      title: form.title || file.name, description: form.description || null,
      category: form.category as Document['category'], file_path: filePath,
      file_name: file.name, file_size: file.size, mime_type: file.type,
      project_id: form.project_id || null, meeting_id: form.meeting_id || null,
      uploaded_by: user?.id || null, is_public: false,
    });

    setUploading(false);
    setShowForm(false);
    setFile(null);
    setForm({ title: '', description: '', category: 'general', project_id: '', meeting_id: '' });
    fetchData();
  };

  const handleDelete = async (doc: DocWithRels) => {
    if (!confirm('Delete this document?')) return;
    await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchData();
  };

  const handleDownload = async (doc: DocWithRels) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const filtered = docs
    .filter(d => filterCat === 'all' || d.category === filterCat)
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.file_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Documents</h1>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Upload Document
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', ...categoryOptions].map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filterCat === c ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No documents found</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Document', 'Category', 'Project', 'Meeting', 'Size', 'Uploaded', ''].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoryIcons[doc.category] || '📄'}</span>
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-400">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${categoryColors[doc.category] || 'bg-gray-100 text-gray-700'}`}>
                        {doc.category}
                      </span>
                    </td>
                    <td className="table-cell">{doc.project?.title || '—'}</td>
                    <td className="table-cell">{doc.meeting ? formatDate(doc.meeting.date) : '—'}</td>
                    <td className="table-cell">{formatFileSize(doc.file_size)}</td>
                    <td className="table-cell">{formatDate(doc.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => handleDownload(doc)} title="Download" className="text-gray-400 hover:text-primary"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(doc)} title="Delete" className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Upload Document</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleUpload} className="p-6 space-y-4">
                <div>
                  <label className="label">File *</label>
                  <input
                    type="file"
                    required
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-light cursor-pointer"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <label className="label">Title</label>
                  <input className="input" placeholder="Leave blank to use filename" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input resize-none min-h-[64px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Related Project</label>
                  <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Related Meeting</label>
                  <select className="input" value={form.meeting_id} onChange={e => setForm(f => ({ ...f, meeting_id: e.target.value }))}>
                    <option value="">Select meeting...</option>
                    {meetings.map(m => <option key={m.id} value={m.id}>{m.title} — {formatDate(m.date)}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Upload
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
