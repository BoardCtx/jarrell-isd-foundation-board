'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { Document, DocumentFolder, Project, Meeting } from '@/lib/database.types';
import {
  Plus, Loader2, FileText, X, Trash2, Download, Search,
  FolderOpen, Folder, ChevronRight, Home, ArrowLeft,
  FolderPlus, Upload, MoreVertical, Edit2, Link2
} from 'lucide-react';

type DocWithRels = Document & { project?: Project | null; meeting?: Meeting | null };
type FolderWithCounts = DocumentFolder & { doc_count: number; subfolder_count: number };

export default function DocumentsPage() {
  const supabase = createClient();

  // State
  const [folders, setFolders] = useState<FolderWithCounts[]>([]);
  const [docs, setDocs] = useState<DocWithRels[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<DocWithRels[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<DocumentFolder | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DocumentFolder[]>([]);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRenameFolder, setShowRenameFolder] = useState<DocumentFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', description: '', project_id: '', meeting_id: '' });
  const [contextMenu, setContextMenu] = useState<{ folder: DocumentFolder; x: number; y: number } | null>(null);

  // Fetch folders and documents for current directory
  const fetchData = useCallback(async () => {
    const parentId = currentFolder?.id || null;

    // Fetch subfolders of current folder
    let folderQuery = supabase
      .from('document_folders')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name');

    if (parentId) {
      folderQuery = folderQuery.eq('parent_id', parentId);
    } else {
      folderQuery = folderQuery.is('parent_id', null);
    }

    // Fetch documents in current folder
    let docQuery = supabase
      .from('documents')
      .select('*, project:projects(*), meeting:meetings(*)')
      .order('created_at', { ascending: false });

    if (parentId) {
      docQuery = docQuery.eq('folder_id', parentId);
    } else {
      docQuery = docQuery.is('folder_id', null);
    }

    // Fetch projects and meetings for upload form
    const [foldersRes, docsRes, projRes, meetRes] = await Promise.all([
      folderQuery,
      docQuery,
      supabase.from('projects').select('*').order('title'),
      supabase.from('meetings').select('*').order('date', { ascending: false }).limit(20),
    ]);

    // Get document counts for each subfolder
    const rawFolders = (foldersRes.data || []) as DocumentFolder[];
    const folderIds = rawFolders.map(f => f.id);

    let foldersWithCounts: FolderWithCounts[] = rawFolders.map(f => ({
      ...f, doc_count: 0, subfolder_count: 0,
    }));

    if (folderIds.length > 0) {
      // Count direct documents per folder
      const { data: docCounts } = await supabase
        .from('documents')
        .select('folder_id')
        .in('folder_id', folderIds);

      // Count direct subfolders per folder
      const { data: subCounts } = await supabase
        .from('document_folders')
        .select('parent_id')
        .in('parent_id', folderIds);

      // Count linked documents per folder
      const { data: linkCounts } = await supabase
        .from('document_folder_links')
        .select('folder_id')
        .in('folder_id', folderIds);

      const docCountMap: Record<string, number> = {};
      const subCountMap: Record<string, number> = {};
      for (const d of (docCounts || [])) {
        docCountMap[d.folder_id] = (docCountMap[d.folder_id] || 0) + 1;
      }
      for (const d of (linkCounts || [])) {
        docCountMap[d.folder_id] = (docCountMap[d.folder_id] || 0) + 1;
      }
      for (const s of (subCounts || [])) {
        subCountMap[s.parent_id] = (subCountMap[s.parent_id] || 0) + 1;
      }
      foldersWithCounts = rawFolders.map(f => ({
        ...f,
        doc_count: docCountMap[f.id] || 0,
        subfolder_count: subCountMap[f.id] || 0,
      }));
    }

    setFolders(foldersWithCounts);
    setDocs((docsRes.data as DocWithRels[]) || []);
    setProjects(projRes.data || []);
    setMeetings(meetRes.data || []);

    // Fetch virtual-linked documents for this folder
    if (parentId) {
      const { data: links } = await supabase
        .from('document_folder_links')
        .select('document_id')
        .eq('folder_id', parentId);
      if (links && links.length > 0) {
        const linkedIds = links.map(l => l.document_id);
        const { data: ld } = await supabase
          .from('documents')
          .select('*, project:projects(*), meeting:meetings(*)')
          .in('id', linkedIds);
        setLinkedDocs((ld as DocWithRels[]) || []);
      } else {
        setLinkedDocs([]);
      }
    } else {
      setLinkedDocs([]);
    }

    setLoading(false);
  }, [currentFolder?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build breadcrumb when navigating
  const navigateToFolder = async (folder: DocumentFolder | null) => {
    setLoading(true);
    setSearch('');
    if (!folder) {
      setCurrentFolder(null);
      setBreadcrumb([]);
    } else {
      setCurrentFolder(folder);
      // Build breadcrumb by walking up parent chain
      const crumbs: DocumentFolder[] = [folder];
      let current = folder;
      while (current.parent_id) {
        const { data } = await supabase
          .from('document_folders')
          .select('*')
          .eq('id', current.parent_id)
          .single();
        if (data) {
          crumbs.unshift(data as DocumentFolder);
          current = data as DocumentFolder;
        } else break;
      }
      setBreadcrumb(crumbs);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('document_folders').insert({
      name: newFolderName.trim(),
      parent_id: currentFolder?.id || null,
      icon: '📁',
      color: 'bg-gray-100 text-gray-700',
      is_system: false,
      meeting_id: null,
      created_by: user?.id || null,
    });
    setNewFolderName('');
    setShowNewFolder(false);
    fetchData();
  };

  // Rename folder
  const handleRenameFolder = async () => {
    if (!showRenameFolder || !newFolderName.trim()) return;
    await supabase.from('document_folders')
      .update({ name: newFolderName.trim() })
      .eq('id', showRenameFolder.id);
    setNewFolderName('');
    setShowRenameFolder(null);
    fetchData();
  };

  // Delete folder
  const handleDeleteFolder = async (folder: DocumentFolder) => {
    if (folder.is_system) { alert('System folders cannot be deleted.'); return; }
    if (!confirm(`Delete "${folder.name}" and all its contents?`)) return;
    await supabase.from('document_folders').delete().eq('id', folder.id);
    fetchData();
  };

  // Upload document to current folder
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Please select a file'); return; }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const filePath = `${user?.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
    if (uploadError) {
      alert('Storage upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: docError } = await supabase.from('documents').insert({
      title: form.title || file.name,
      description: form.description || null,
      category: null,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      folder_id: currentFolder?.id || null,
      project_id: form.project_id || null,
      meeting_id: form.meeting_id || null,
      uploaded_by: user?.id || null,
      is_public: false,
    });

    if (docError) {
      alert('Document record failed: ' + docError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    setShowUpload(false);
    setFile(null);
    setForm({ title: '', description: '', project_id: '', meeting_id: '' });
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
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // Remove virtual link (not the document itself)
  const handleUnlink = async (doc: DocWithRels) => {
    if (!currentFolder) return;
    await supabase
      .from('document_folder_links')
      .delete()
      .eq('document_id', doc.id)
      .eq('folder_id', currentFolder.id);
    fetchData();
  };

  // File type icon
  const getFileIcon = (mimeType: string | null, fileName: string) => {
    if (mimeType?.includes('pdf')) return '📕';
    if (mimeType?.includes('spreadsheet') || fileName.match(/\.(xlsx?|csv)$/i)) return '📊';
    if (mimeType?.includes('presentation') || fileName.match(/\.pptx?$/i)) return '📊';
    if (mimeType?.includes('word') || fileName.match(/\.docx?$/i)) return '📝';
    if (mimeType?.includes('image')) return '🖼️';
    return '📄';
  };

  // Combined documents: direct + linked
  const allDocs = [
    ...docs.map(d => ({ ...d, _isLinked: false })),
    ...linkedDocs.map(d => ({ ...d, _isLinked: true })),
  ];

  const filteredDocs = allDocs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFolders = folders.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-8" onClick={() => setContextMenu(null)}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">Documents</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setNewFolderName(''); setShowNewFolder(true); }}
              className="btn-secondary flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
            <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1 mb-4 text-sm bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <button
            onClick={() => navigateToFolder(null)}
            className={`flex items-center gap-1 hover:text-primary transition-colors ${!currentFolder ? 'text-primary font-semibold' : 'text-gray-500'}`}
          >
            <Home className="w-4 h-4" />
            <span>Documents</span>
          </button>
          {breadcrumb.map((folder, i) => (
            <span key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <button
                onClick={() => navigateToFolder(folder)}
                className={`hover:text-primary transition-colors ${i === breadcrumb.length - 1 ? 'text-primary font-semibold' : 'text-gray-500'}`}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>

        {/* Search + Back button */}
        <div className="flex gap-3 mb-5">
          {currentFolder && (
            <button
              onClick={() => {
                const parentCrumb = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;
                navigateToFolder(parentCrumb);
              }}
              className="btn-secondary flex items-center gap-1.5 px-3"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search in this folder..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredFolders.length === 0 && filteredDocs.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No results found' : 'This folder is empty'}</p>
            <p className="text-sm mt-1">Upload a document or create a subfolder to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Folders Grid */}
            {filteredFolders.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Folders ({filteredFolders.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredFolders.map(folder => (
                    <div
                      key={folder.id}
                      className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer p-4"
                      onDoubleClick={() => navigateToFolder(folder)}
                      onClick={() => navigateToFolder(folder)}
                    >
                      {/* Context menu button */}
                      {!folder.is_system && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ folder, x: e.clientX, y: e.clientY });
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-opacity"
                        >
                          <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                      <div className="text-center">
                        <div className="text-3xl mb-2">{folder.icon}</div>
                        <p className="font-medium text-sm text-gray-800 truncate">{folder.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {folder.subfolder_count > 0 && `${folder.subfolder_count} folders`}
                          {folder.subfolder_count > 0 && folder.doc_count > 0 && ', '}
                          {folder.doc_count > 0 && `${folder.doc_count} files`}
                          {folder.subfolder_count === 0 && folder.doc_count === 0 && 'Empty'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Table */}
            {filteredDocs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Files ({filteredDocs.length})
                </h2>
                <div className="card p-0 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Document', 'Size', 'Uploaded', ''].map(h => (
                          <th key={h} className="table-header">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDocs.map(doc => (
                        <tr key={doc.id + (doc._isLinked ? '-link' : '')} className="hover:bg-gray-50 transition-colors">
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getFileIcon(doc.mime_type, doc.file_name)}</span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-gray-900">{doc.title}</p>
                                  {doc._isLinked && (
                                    <span title="Linked from another folder" className="text-gray-300"><Link2 className="w-3 h-3" /></span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{doc.file_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell text-sm text-gray-500">{formatFileSize(doc.file_size)}</td>
                          <td className="table-cell text-sm text-gray-500">{formatDate(doc.created_at)}</td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => handleDownload(doc)} title="Download" className="text-gray-400 hover:text-primary"><Download className="w-4 h-4" /></button>
                              {doc._isLinked ? (
                                <button onClick={() => handleUnlink(doc)} title="Remove link" className="text-gray-400 hover:text-orange-500"><Link2 className="w-4 h-4" /></button>
                              ) : (
                                <button onClick={() => handleDelete(doc)} title="Delete" className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setNewFolderName(contextMenu.folder.name);
                setShowRenameFolder(contextMenu.folder);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5" /> Rename
            </button>
            <button
              onClick={() => { handleDeleteFolder(contextMenu.folder); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}

        {/* New Folder Modal */}
        {showNewFolder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">New Folder</h2>
                <button onClick={() => setShowNewFolder(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <input
                  className="input"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                />
                <div className="flex gap-3 mt-4">
                  <button onClick={handleCreateFolder} className="btn-primary">Create</button>
                  <button onClick={() => setShowNewFolder(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rename Folder Modal */}
        {showRenameFolder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="font-semibold text-lg">Rename Folder</h2>
                <button onClick={() => setShowRenameFolder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <input
                  className="input"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
                  autoFocus
                />
                <div className="flex gap-3 mt-4">
                  <button onClick={handleRenameFolder} className="btn-primary">Rename</button>
                  <button onClick={() => setShowRenameFolder(null)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="font-semibold text-lg">Upload Document</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Uploading to: {currentFolder ? breadcrumb.map(f => f.name).join(' / ') : 'Root'}
                  </p>
                </div>
                <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                  <label className="label">Description</label>
                  <textarea className="input resize-none min-h-[64px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Related Project</label>
                  <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">None</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Related Meeting</label>
                  <select className="input" value={form.meeting_id} onChange={e => setForm(f => ({ ...f, meeting_id: e.target.value }))}>
                    <option value="">None</option>
                    {meetings.map(m => <option key={m.id} value={m.id}>{m.title} — {formatDate(m.date)}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Upload
                  </button>
                  <button type="button" onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
