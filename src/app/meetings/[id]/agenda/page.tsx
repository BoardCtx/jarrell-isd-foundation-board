'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Globe,
  Eye,
  X,
  Check,
  Clock,
  ArrowLeft,
  FileText,
  Upload,
  Loader2,
  Folder,
  FolderOpen,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocLink {
  document_id: string
  documents: {
    id: string
    title: string
    file_name: string
    category: string
  }
}

interface SubItem {
  id: string
  item_id: string
  title: string
  description: string | null
  position: number
  agenda_document_links?: DocLink[]
}

interface Item {
  id: string
  section_id: string
  title: string
  description: string | null
  duration_minutes: number | null
  position: number
  agenda_sub_items: SubItem[]
  agenda_document_links?: DocLink[]
}

interface Section {
  id: string
  meeting_id: string
  title: string
  description: string | null
  position: number
  agenda_items: Item[]
  agenda_document_links?: DocLink[]
}

interface Meeting {
  id: string
  title: string
  date: string
  time: string | null
  agenda_published: boolean
}

interface AvailableDoc {
  id: string
  title: string
  file_name: string
  category: string
}

// ── Sortable Sub-Item ──────────────────────────────────────────────────────────

function SortableSubItem({
  sub,
  onEdit,
  onDelete,
  onAttach,
}: {
  sub: SubItem
  onEdit: (sub: SubItem) => void
  onDelete: (id: string) => void
  onAttach: (type: string, id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 ml-10 py-1.5 px-3 rounded bg-white border border-gray-100 group">
      <button {...attributes} {...listeners} className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab">
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium truncate">{sub.title}</p>
        {sub.description && <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>}
        {(sub.agenda_document_links?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {sub.agenda_document_links!.map(l => (
              <span key={l.document_id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                <FileText size={10} /> {l.documents.title}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onAttach('sub_item', sub.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Attach document">
          <Paperclip size={13} />
        </button>
        <button onClick={() => onEdit(sub)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(sub.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Sortable Item ──────────────────────────────────────────────────────────────

function SortableItem({
  item,
  onEdit,
  onDelete,
  onAttach,
  onAddSubItem,
  onEditSubItem,
  onDeleteSubItem,
  onSubDragEnd,
}: {
  item: Item
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onAttach: (type: string, id: string) => void
  onAddSubItem: (itemId: string) => void
  onEditSubItem: (sub: SubItem) => void
  onDeleteSubItem: (id: string, itemId: string) => void
  onSubDragEnd: (event: any, itemId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const subIds = item.agenda_sub_items.map(s => s.id)

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg bg-gray-50 mb-2">
      <div className="flex items-start gap-2 p-3 group">
        <button {...attributes} {...listeners} className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab">
          <GripVertical size={15} />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="mt-0.5 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800">{item.title}</p>
            {item.duration_minutes && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Clock size={11} /> {item.duration_minutes}m
              </span>
            )}
          </div>
          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          {(item.agenda_document_links?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.agenda_document_links!.map(l => (
                <span key={l.document_id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                  <FileText size={10} /> {l.documents.title}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAttach('item', item.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Attach document">
            <Paperclip size={13} />
          </button>
          <button onClick={() => onEdit(item)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pb-2 px-2 space-y-1">
          <DndContext
            sensors={useSensors(useSensor(PointerSensor))}
            collisionDetection={closestCenter}
            onDragEnd={(e) => onSubDragEnd(e, item.id)}
          >
            <SortableContext items={subIds} strategy={verticalListSortingStrategy}>
              {item.agenda_sub_items.map(sub => (
                <SortableSubItem
                  key={sub.id}
                  sub={sub}
                  onEdit={onEditSubItem}
                  onDelete={(id) => onDeleteSubItem(id, item.id)}
                  onAttach={onAttach}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={() => onAddSubItem(item.id)}
            className="ml-10 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 py-1 px-2 rounded hover:bg-blue-50 transition-colors"
          >
            <Plus size={12} /> Add sub-item
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sortable Section ───────────────────────────────────────────────────────────

function SortableSection({
  section,
  onEdit,
  onDelete,
  onAttach,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAttachItem,
  onAddSubItem,
  onEditSubItem,
  onDeleteSubItem,
  onSubDragEnd,
  onItemDragEnd,
}: {
  section: Section
  onEdit: (section: Section) => void
  onDelete: (id: string) => void
  onAttach: (type: string, id: string) => void
  onAddItem: (sectionId: string) => void
  onEditItem: (item: Item) => void
  onDeleteItem: (id: string, sectionId: string) => void
  onAttachItem: (type: string, id: string) => void
  onAddSubItem: (itemId: string) => void
  onEditSubItem: (sub: SubItem) => void
  onDeleteSubItem: (id: string, itemId: string) => void
  onSubDragEnd: (event: any, itemId: string) => void
  onItemDragEnd: (event: any, sectionId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const itemIds = section.agenda_items.map(i => i.id)

  return (
    <div ref={setNodeRef} style={style} className="border border-blue-200 rounded-xl bg-blue-50/30 mb-4">
      <div className="flex items-start gap-2 p-4 group">
        <button {...attributes} {...listeners} className="mt-0.5 text-blue-300 hover:text-blue-500 cursor-grab">
          <GripVertical size={16} />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="mt-0.5 text-blue-400 hover:text-blue-600">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-blue-900 text-base">{section.title}</p>
          {section.description && <p className="text-sm text-blue-700 mt-0.5">{section.description}</p>}
          {(section.agenda_document_links?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {section.agenda_document_links!.map(l => (
                <span key={l.document_id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">
                  <FileText size={10} /> {l.documents.title}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAttach('section', section.id)} className="p-1.5 text-blue-400 hover:text-blue-700 rounded" title="Attach document">
            <Paperclip size={14} />
          </button>
          <button onClick={() => onEdit(section)} className="p-1.5 text-blue-400 hover:text-blue-700 rounded">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(section.id)} className="p-1.5 text-blue-400 hover:text-red-500 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <DndContext
            sensors={useSensors(useSensor(PointerSensor))}
            collisionDetection={closestCenter}
            onDragEnd={(e) => onItemDragEnd(e, section.id)}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {section.agenda_items.map(item => (
                <SortableItem
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                  onDelete={(id) => onDeleteItem(id, section.id)}
                  onAttach={onAttachItem}
                  onAddSubItem={onAddSubItem}
                  onEditSubItem={onEditSubItem}
                  onDeleteSubItem={onDeleteSubItem}
                  onSubDragEnd={onSubDragEnd}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={() => onAddItem(section.id)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 py-1.5 px-3 rounded-lg hover:bg-blue-100 transition-colors mt-1"
          >
            <Plus size={14} /> Add item
          </button>
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({
  title,
  fields,
  onSave,
  onClose,
}: {
  title: string
  fields: { label: string; key: string; value: string; multiline?: boolean; type?: string }[]
  onSave: (values: Record<string, string>) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              {f.multiline ? (
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type={f.type || 'text'}
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => onSave(values)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Document Attach Modal ──────────────────────────────────────────────────────

function AttachDocModal({
  meetingId,
  entityType,
  entityId,
  attachedLinks,
  supabase,
  onClose,
  onRefresh,
}: {
  meetingId: string
  entityType: string
  entityId: string
  attachedLinks: DocLink[]
  supabase: any
  onClose: () => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<'upload' | 'link'>('upload')
  const [docs, setDocs] = useState<AvailableDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set(attachedLinks.map(l => l.document_id)))
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Folder tree state for Link Existing tab
  const [allFolders, setAllFolders] = useState<any[]>([])
  const [allDocs, setAllDocs] = useState<any[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [treeLoading, setTreeLoading] = useState(true)
  const [linkSearch, setLinkSearch] = useState('')

  function fetchDocs() {
    supabase
      .from('documents')
      .select('id, title, file_name, category')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        setDocs(data || [])
        setLoading(false)
      })
  }

  // Load all folders and documents for the tree
  async function fetchTree() {
    setTreeLoading(true)
    const [foldersRes, docsRes] = await Promise.all([
      supabase.from('document_folders').select('id, name, parent_id, icon').order('name'),
      supabase.from('documents').select('id, title, file_name, folder_id').order('file_name'),
    ])
    setAllFolders(foldersRes.data || [])
    setAllDocs(docsRes.data || [])
    setTreeLoading(false)
  }

  useEffect(() => { fetchDocs() }, [])
  useEffect(() => { if (tab === 'link') fetchTree() }, [tab])

  // Ensure Board Meetings / [Year] / [MM-DD-YYYY] folder structure exists, return leaf folder id
  async function ensureMeetingFolder(): Promise<string | null> {
    try {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('date, title')
        .eq('id', meetingId)
        .single()
      if (!meeting?.date) return null

      const year = meeting.date.slice(0, 4)
      const month = meeting.date.slice(5, 7)
      const day = meeting.date.slice(8, 10)
      const dateStr = `${month}-${day}-${year}`

      // Find or create "Board Meetings" root folder
      let { data: rootFolder } = await supabase
        .from('document_folders')
        .select('id')
        .eq('name', 'Board Meetings')
        .is('parent_id', null)
        .single()
      if (!rootFolder) {
        const { data: created } = await supabase
          .from('document_folders')
          .insert({ name: 'Board Meetings', icon: '📋', color: 'bg-green-100 text-green-700', is_system: true, parent_id: null, meeting_id: null, created_by: null })
          .select('id')
          .single()
        rootFolder = created
      }
      if (!rootFolder) return null

      // Find or create year subfolder
      let { data: yearFolder } = await supabase
        .from('document_folders')
        .select('id')
        .eq('name', year)
        .eq('parent_id', rootFolder.id)
        .single()
      if (!yearFolder) {
        const { data: created } = await supabase
          .from('document_folders')
          .insert({ name: year, icon: '📅', color: 'bg-green-50 text-green-600', is_system: true, parent_id: rootFolder.id, meeting_id: null, created_by: null })
          .select('id')
          .single()
        yearFolder = created
      }
      if (!yearFolder) return null

      // Find or create date subfolder (MM-DD-YYYY format)
      let { data: dateFolder } = await supabase
        .from('document_folders')
        .select('id')
        .eq('name', dateStr)
        .eq('parent_id', yearFolder.id)
        .single()
      if (!dateFolder) {
        const { data: created } = await supabase
          .from('document_folders')
          .insert({ name: dateStr, icon: '📋', color: 'bg-green-50 text-green-600', is_system: true, parent_id: yearFolder.id, meeting_id: meetingId, created_by: null })
          .select('id')
          .single()
        dateFolder = created
      }

      return dateFolder?.id || null
    } catch { return null }
  }

  // Link an existing document to this agenda entity
  async function linkDoc(docId: string) {
    await supabase
      .from('agenda_document_links')
      .insert({ document_id: docId, entity_type: entityType, entity_id: entityId })
    setAttachedIds(prev => new Set([...prev, docId]))
    onRefresh()
  }

  // Unlink a document from this agenda entity
  async function unlinkDoc(docId: string) {
    await supabase
      .from('agenda_document_links')
      .delete()
      .eq('document_id', docId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
    setAttachedIds(prev => { const s = new Set(prev); s.delete(docId); return s })
    onRefresh()
  }

  // Upload a new document, auto-attach to current entity, place in meeting folder
  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        alert('Auth error: ' + (userError?.message || 'Not logged in'))
        setUploading(false)
        return
      }
      const filePath = `${user.id}/${Date.now()}_${uploadFile.name}`

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadFile)
      if (uploadError) {
        alert('Storage upload failed: ' + uploadError.message)
        setUploading(false)
        return
      }

      // Ensure meeting folder exists
      const meetingFolderId = await ensureMeetingFolder()

      // Insert document record — title = filename
      const { data: newDoc, error: docError } = await supabase
        .from('documents')
        .insert({
          title: uploadFile.name,
          description: null,
          category: null,
          file_path: filePath,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type,
          folder_id: meetingFolderId || null,
          project_id: null,
          meeting_id: meetingId,
          uploaded_by: user.id,
          is_public: false,
        })
        .select('id')
        .single()

      if (docError) {
        alert('Document insert failed: ' + docError.message)
        setUploading(false)
        return
      }

      if (newDoc) {
        // Auto-attach to the current agenda entity
        const { error: linkError } = await supabase
          .from('agenda_document_links')
          .insert({ document_id: newDoc.id, entity_type: entityType, entity_id: entityId })
        if (linkError) console.error('Agenda link error:', linkError.message)
        setAttachedIds(prev => new Set([...prev, newDoc.id]))
      }

      setUploadFile(null)
      fetchDocs()
      onRefresh()
    } catch (err: any) {
      alert('Unexpected error: ' + (err?.message || String(err)))
    } finally {
      setUploading(false)
    }
  }

  // Toggle folder expanded/collapsed
  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const s = new Set(prev)
      if (s.has(folderId)) s.delete(folderId); else s.add(folderId)
      return s
    })
  }

  // Search filter: check if a document matches the search query
  function docMatchesSearch(doc: any): boolean {
    if (!linkSearch.trim()) return true
    const q = linkSearch.toLowerCase()
    return doc.file_name?.toLowerCase().includes(q) || doc.title?.toLowerCase().includes(q)
  }

  // Check if a folder (or any of its descendants) has matching docs
  function folderHasMatches(folderId: string): boolean {
    const folderDocs = allDocs.filter(d => d.folder_id === folderId && !attachedIds.has(d.id))
    if (folderDocs.some(docMatchesSearch)) return true
    const childFolders = allFolders.filter(f => f.parent_id === folderId)
    return childFolders.some(cf => folderHasMatches(cf.id))
  }

  // Render a folder node and its children recursively
  function renderFolderNode(folder: any, depth: number) {
    const isExpanded = expandedFolders.has(folder.id)
    const childFolders = allFolders.filter(f => f.parent_id === folder.id)
    const folderDocs = allDocs.filter(d => d.folder_id === folder.id && !attachedIds.has(d.id)).filter(docMatchesSearch)
    const hasContent = childFolders.length > 0 || folderDocs.length > 0

    // When searching, hide folders with no matching docs anywhere in subtree
    if (linkSearch.trim() && !folderHasMatches(folder.id)) return null

    // When searching, auto-expand folders that have matches
    const shouldShow = isExpanded || (linkSearch.trim() && folderHasMatches(folder.id))

    return (
      <div key={folder.id}>
        <button
          onClick={() => toggleFolder(folder.id)}
          className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-gray-50 rounded text-left transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasContent ? (
            shouldShow ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          {shouldShow ? (
            <FolderOpen size={15} className="text-amber-500 flex-shrink-0" />
          ) : (
            <Folder size={15} className="text-amber-500 flex-shrink-0" />
          )}
          <span className="text-sm text-gray-700 truncate">{folder.icon && folder.icon !== '📁' ? `${folder.icon} ` : ''}{folder.name}</span>
        </button>
        {shouldShow && (
          <div>
            {childFolders.map(cf => renderFolderNode(cf, depth + 1))}
            {folderDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => linkDoc(doc.id)}
                className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-blue-50 rounded text-left transition-colors group"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                <FileText size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate flex-1">{doc.file_name}</span>
                <Plus size={13} className="text-blue-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Root-level docs (no folder)
  const rootDocs = allDocs.filter(d => !d.folder_id && !attachedIds.has(d.id)).filter(docMatchesSearch)
  const rootFolders = allFolders.filter(f => !f.parent_id)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Attach Document</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload size={14} className="inline mr-1.5 -mt-0.5" />Upload File
          </button>
          <button
            onClick={() => setTab('link')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'link' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Folder size={14} className="inline mr-1.5 -mt-0.5" />Link Existing
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Upload Tab */}
          {tab === 'upload' && (
            <div className="px-6 py-5">
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-gray-600">{uploadFile.name}</p>
                  )}
                </div>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : 'Upload & Attach'}
                </button>
                <p className="text-xs text-gray-400 text-center">File will be saved to Board Meetings folder and attached to this agenda item.</p>
              </div>
            </div>
          )}

          {/* Link Existing Tab — Folder Tree */}
          {tab === 'link' && (
            <div className="py-2">
              <div className="px-4 pb-2">
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search all documents…"
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                />
              </div>
              {treeLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
              ) : rootFolders.length === 0 && rootDocs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No documents available.</p>
              ) : (
                <div className="px-2">
                  {rootFolders.map(f => renderFolderNode(f, 0))}
                  {rootDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => linkDoc(doc.id)}
                      className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-blue-50 rounded text-left transition-colors group"
                      style={{ paddingLeft: '8px' }}
                    >
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate flex-1">{doc.file_name}</span>
                      <Plus size={13} className="text-blue-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                  {linkSearch.trim() && rootFolders.every(f => !folderHasMatches(f.id)) && rootDocs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">No matching documents found.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t">
          <button onClick={onClose} className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AgendaBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  // Modal states
  const [editModal, setEditModal] = useState<{
    type: 'section' | 'item' | 'sub_item'
    data: any
    sectionId?: string
    itemId?: string
  } | null>(null)

  const [attachModal, setAttachModal] = useState<{
    entityType: string
    entityId: string
    links: DocLink[]
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
    const [meetingRes, sectionsRes] = await Promise.all([
      supabase.from('meetings').select('id, title, date, time, agenda_published').eq('id', meetingId).single(),
      supabase
        .from('agenda_sections')
        .select(`
          *,
          agenda_items(
            *,
            agenda_sub_items(*)
          )
        `)
        .eq('meeting_id', meetingId)
        .order('position'),
    ])

    if (meetingRes.data) setMeeting(meetingRes.data)

    const rawSecs = sectionsRes.data || []

    // Collect all entity IDs to fetch document links in one query
    const sectionIds = rawSecs.map((s: any) => s.id)
    const itemIds = rawSecs.flatMap((s: any) => (s.agenda_items || []).map((i: any) => i.id))
    const subItemIds = rawSecs.flatMap((s: any) =>
      (s.agenda_items || []).flatMap((i: any) => (i.agenda_sub_items || []).map((si: any) => si.id))
    )
    const allIds = [...sectionIds, ...itemIds, ...subItemIds]

    let linksByEntityId: Record<string, DocLink[]> = {}
    if (allIds.length > 0) {
      const { data: links } = await supabase
        .from('agenda_document_links')
        .select('document_id, entity_id, documents(id, title, file_name, category)')
        .in('entity_id', allIds)
      for (const link of (links || [])) {
        if (!linksByEntityId[(link as any).entity_id]) linksByEntityId[(link as any).entity_id] = []
        linksByEntityId[(link as any).entity_id].push(link as any)
      }
    }

    const secs = rawSecs.map((s: any) => ({
      ...s,
      agenda_document_links: linksByEntityId[s.id] || [],
      agenda_items: (s.agenda_items || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((item: any) => ({
          ...item,
          agenda_document_links: linksByEntityId[item.id] || [],
          agenda_sub_items: (item.agenda_sub_items || [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((si: any) => ({
              ...si,
              agenda_document_links: linksByEntityId[si.id] || [],
            })),
        })),
    }))

    setSections(secs)
    setLoading(false)
  }, [meetingId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Section CRUD ─────────────────────────────────────────────────────────────

  async function addSection() {
    const position = sections.length
    const { data, error } = await supabase
      .from('agenda_sections')
      .insert({ meeting_id: meetingId, title: 'New Section', position })
      .select()
      .single()
    if (!error && data) {
      setEditModal({ type: 'section', data: { ...data, agenda_items: [], agenda_document_links: [] } })
      await fetchData()
    }
  }

  async function saveSection(values: Record<string, string>) {
    const { data } = editModal!
    await supabase
      .from('agenda_sections')
      .update({ title: values.title, description: values.description || null })
      .eq('id', data.id)
    setEditModal(null)
    await fetchData()
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete this section and all its items?')) return
    await supabase.from('agenda_sections').delete().eq('id', id)
    await fetchData()
  }

  async function handleSectionDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sections, oldIndex, newIndex)
    setSections(reordered)
    await Promise.all(
      reordered.map((s, i) => supabase.from('agenda_sections').update({ position: i }).eq('id', s.id))
    )
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────────

  async function addItem(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    const position = section ? section.agenda_items.length : 0
    const { data, error } = await supabase
      .from('agenda_items')
      .insert({ section_id: sectionId, title: 'New Item', position })
      .select()
      .single()
    if (!error && data) {
      setEditModal({ type: 'item', data: { ...data, agenda_sub_items: [], agenda_document_links: [] }, sectionId })
      await fetchData()
    }
  }

  async function saveItem(values: Record<string, string>) {
    const { data } = editModal!
    await supabase
      .from('agenda_items')
      .update({
        title: values.title,
        description: values.description || null,
        duration_minutes: values.duration ? parseInt(values.duration) : null,
      })
      .eq('id', data.id)
    setEditModal(null)
    await fetchData()
  }

  async function deleteItem(id: string, sectionId: string) {
    if (!confirm('Delete this item and all its sub-items?')) return
    await supabase.from('agenda_items').delete().eq('id', id)
    await fetchData()
  }

  async function handleItemDragEnd(event: any, sectionId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sectionIdx = sections.findIndex(s => s.id === sectionId)
    if (sectionIdx === -1) return
    const items = sections[sectionIdx].agenda_items
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    const newSections = [...sections]
    newSections[sectionIdx] = { ...newSections[sectionIdx], agenda_items: reordered }
    setSections(newSections)
    await Promise.all(
      reordered.map((item, i) => supabase.from('agenda_items').update({ position: i }).eq('id', item.id))
    )
  }

  // ── Sub-Item CRUD ─────────────────────────────────────────────────────────────

  async function addSubItem(itemId: string) {
    let position = 0
    for (const s of sections) {
      const item = s.agenda_items.find(i => i.id === itemId)
      if (item) { position = item.agenda_sub_items.length; break }
    }
    const { data, error } = await supabase
      .from('agenda_sub_items')
      .insert({ item_id: itemId, title: 'New Sub-item', position })
      .select()
      .single()
    if (!error && data) {
      setEditModal({ type: 'sub_item', data: { ...data, agenda_document_links: [] }, itemId })
      await fetchData()
    }
  }

  async function saveSubItem(values: Record<string, string>) {
    const { data } = editModal!
    await supabase
      .from('agenda_sub_items')
      .update({ title: values.title, description: values.description || null })
      .eq('id', data.id)
    setEditModal(null)
    await fetchData()
  }

  async function deleteSubItem(id: string, itemId: string) {
    await supabase.from('agenda_sub_items').delete().eq('id', id)
    await fetchData()
  }

  async function handleSubDragEnd(event: any, itemId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    for (let si = 0; si < sections.length; si++) {
      const itemIdx = sections[si].agenda_items.findIndex(i => i.id === itemId)
      if (itemIdx === -1) continue
      const subs = sections[si].agenda_items[itemIdx].agenda_sub_items
      const oldIndex = subs.findIndex(s => s.id === active.id)
      const newIndex = subs.findIndex(s => s.id === over.id)
      const reordered = arrayMove(subs, oldIndex, newIndex)
      const newSections = [...sections]
      const newItems = [...newSections[si].agenda_items]
      newItems[itemIdx] = { ...newItems[itemIdx], agenda_sub_items: reordered }
      newSections[si] = { ...newSections[si], agenda_items: newItems }
      setSections(newSections)
      await Promise.all(
        reordered.map((sub, i) => supabase.from('agenda_sub_items').update({ position: i }).eq('id', sub.id))
      )
      break
    }
  }

  // ── Attach Modal helpers ──────────────────────────────────────────────────────

  function openAttach(entityType: string, entityId: string) {
    let links: DocLink[] = []
    if (entityType === 'section') {
      const s = sections.find(s => s.id === entityId)
      links = s?.agenda_document_links || []
    } else if (entityType === 'item') {
      for (const s of sections) {
        const item = s.agenda_items.find(i => i.id === entityId)
        if (item) { links = item.agenda_document_links || []; break }
      }
    } else {
      for (const s of sections) {
        for (const item of s.agenda_items) {
          const sub = item.agenda_sub_items.find(sub => sub.id === entityId)
          if (sub) { links = sub.agenda_document_links || []; break }
        }
      }
    }
    setAttachModal({ entityType, entityId, links })
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  async function togglePublish() {
    if (!meeting) return
    setPublishing(true)
    await supabase
      .from('meetings')
      .update({ agenda_published: !meeting.agenda_published })
      .eq('id', meetingId)
    await fetchData()
    setPublishing(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const sectionIds = sections.map(s => s.id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/meetings')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-lg truncate">{meeting?.title}</h1>
            <p className="text-sm text-gray-500">
              {meeting?.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              {meeting?.time ? ` · ${meeting.time}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {meeting?.agenda_published && (
              <a
                href={`/meetings/${meetingId}/agenda/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <Eye size={15} /> Preview
              </a>
            )}
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                meeting?.agenda_published
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Globe size={15} />
              {meeting?.agenda_published ? 'Published' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {sections.map(section => (
              <SortableSection
                key={section.id}
                section={section}
                onEdit={(s) => setEditModal({ type: 'section', data: s })}
                onDelete={deleteSection}
                onAttach={openAttach}
                onAddItem={addItem}
                onEditItem={(item) => setEditModal({ type: 'item', data: item, sectionId: item.section_id })}
                onDeleteItem={deleteItem}
                onAttachItem={openAttach}
                onAddSubItem={addSubItem}
                onEditSubItem={(sub) => setEditModal({ type: 'sub_item', data: sub, itemId: sub.item_id })}
                onDeleteSubItem={deleteSubItem}
                onSubDragEnd={handleSubDragEnd}
                onItemDragEnd={handleItemDragEnd}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={addSection}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Add Section
        </button>

        {sections.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-blue-500" />
            </div>
            <h3 className="text-gray-700 font-semibold mb-1">No agenda yet</h3>
            <p className="text-gray-400 text-sm">Add your first section to get started.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          title={
            editModal.type === 'section'
              ? (editModal.data.id ? 'Edit Section' : 'New Section')
              : editModal.type === 'item'
              ? (editModal.data.id ? 'Edit Item' : 'New Item')
              : 'Edit Sub-item'
          }
          fields={
            editModal.type === 'section'
              ? [
                  { label: 'Title', key: 'title', value: editModal.data.title || '' },
                  { label: 'Description (optional)', key: 'description', value: editModal.data.description || '', multiline: true },
                ]
              : editModal.type === 'item'
              ? [
                  { label: 'Title', key: 'title', value: editModal.data.title || '' },
                  { label: 'Description (optional)', key: 'description', value: editModal.data.description || '', multiline: true },
                  { label: 'Duration (minutes)', key: 'duration', value: editModal.data.duration_minutes?.toString() || '', type: 'number' },
                ]
              : [
                  { label: 'Title', key: 'title', value: editModal.data.title || '' },
                  { label: 'Description (optional)', key: 'description', value: editModal.data.description || '', multiline: true },
                ]
          }
          onSave={
            editModal.type === 'section'
              ? saveSection
              : editModal.type === 'item'
              ? saveItem
              : saveSubItem
          }
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Attach Document Modal */}
      {attachModal && (
        <AttachDocModal
          meetingId={meetingId}
          entityType={attachModal.entityType}
          entityId={attachModal.entityId}
          attachedLinks={attachModal.links}
          supabase={supabase}
          onClose={() => setAttachModal(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}
