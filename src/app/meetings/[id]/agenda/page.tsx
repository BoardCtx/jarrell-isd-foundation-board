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
} from 'lucide-react'

// ââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Sortable Sub-Item ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Sortable Item ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Sortable Section âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Edit Modal âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Document Attach Modal ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
  const [docs, setDocs] = useState<AvailableDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set(attachedLinks.map(l => l.document_id)))

  useEffect(() => {
    supabase
      .from('documents')
      .select('id, title, file_name, category')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        setDocs(data || [])
        setLoading(false)
      })
  }, [])

  async function toggle(docId: string) {
    if (attachedIds.has(docId)) {
      // Detach
      await supabase
        .from('agenda_document_links')
        .delete()
        .eq('document_id', docId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      setAttachedIds(prev => { const s = new Set(prev); s.delete(docId); return s })
    } else {
      // Attach
      await supabase
        .from('agenda_document_links')
        .insert({ document_id: docId, entity_type: entityType, entity_id: entityId })
      setAttachedIds(prev => new Set([...prev, docId]))
    }
    onRefresh()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Attach Documents</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading documentsâ¦</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No documents found. Upload documents in the Documents section first.</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => {
                const attached = attachedIds.has(doc.id)
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggle(doc.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      attached ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${attached ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                      {attached && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize flex-shrink-0">{doc.category}</span>
                  </button>
                )
              })}
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

// ââ Main Page ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
          agenda_document_links(document_id, documents(id, title, file_name, category)),
          agenda_items(
            *,
            agenda_document_links(document_id, documents(id, title, file_name, category)),
            agenda_sub_items(
              *,
              agenda_document_links(document_id, documents(id, title, file_name, category))
            )
          )
        `)
        .eq('meeting_id', meetingId)
        .order('position'),
    ])

    if (meetingRes.data) setMeeting(meetingRes.data)

    const secs = (sectionsRes.data || []).map((s: any) => ({
      ...s,
      agenda_items: (s.agenda_items || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((item: any) => ({
          ...item,
          agenda_sub_items: (item.agenda_sub_items || []).sort((a: any, b: any) => a.position - b.position),
        })),
    }))

    setSections(secs)
    setLoading(false)
  }, [meetingId])

  useEffect(() => { fetchData() }, [fetchData])

  // ââ Section CRUD âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // ââ Item CRUD âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // ââ Sub-Item CRUD âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // ââ Attach Modal helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // ââ Publish âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // ââ Render ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
              {meeting?.time ? ` Â· ${meeting.time}` : ''}
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
