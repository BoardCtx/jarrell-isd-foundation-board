'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FileText, Clock, Printer } from 'lucide-react'

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
  title: string
  description: string | null
  position: number
  agenda_document_links?: DocLink[]
}

interface Item {
  id: string
  title: string
  description: string | null
  duration_minutes: number | null
  position: number
  agenda_sub_items: SubItem[]
  agenda_document_links?: DocLink[]
}

interface Section {
  id: string
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
  location: string | null
  time_zone: string | null
  agenda_published: boolean
}

export default function AgendaViewPage() {
  const params = useParams()
  const supabase = createClientComponentClient()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [notPublished, setNotPublished] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('id, title, date, time, location, time_zone, agenda_published')
        .eq('id', meetingId)
        .single()

      if (!meetingData || !meetingData.agenda_published) {
        setNotPublished(true)
        setLoading(false)
        return
      }

      setMeeting(meetingData)

      // Fetch sections with items and sub-items (no doc links in nested query)
      const { data: sectionsData } = await supabase
        .from('agenda_sections')
        .select(`
          *,
          agenda_items(
            *,
            agenda_sub_items(*)
          )
        `)
        .eq('meeting_id', meetingId)
        .order('position')

      const rawSecs = sectionsData || []

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
          const entityId = (link as any).entity_id
          if (!linksByEntityId[entityId]) linksByEntityId[entityId] = []
          linksByEntityId[entityId].push(link as any)
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
    }

    load()
  }, [meetingId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (notPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Agenda Not Available</h2>
          <p className="text-gray-500">This agenda has not been published yet.</p>
        </div>
      </div>
    )
  }

  const totalMinutes = sections.reduce((total, s) =>
    total + s.agenda_items.reduce((t, i) => t + (i.duration_minutes || 0), 0), 0
  )

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12pt; }
          .print-page { padding: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-white print-page">
        {/* Print button */}
        <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">Board Agenda — Member View (includes attachments)</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition-colors"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="text-center mb-10 pb-8 border-b-2 border-gray-900">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Jarrell ISD Foundation</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{meeting?.title}</h1>
            <div className="flex items-center justify-center gap-4 text-gray-600 text-sm">
              <span>{meeting?.date ? formatDate(meeting.date) : ''}</span>
              {meeting?.time && <span>Â· {meeting.time}</span>}
              {meeting?.location && <span>Â· {meeting.location}</span>}
            </div>
            {totalMinutes > 0 && (
              <p className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-1">
                <Clock size={12} /> Estimated duration: {Math.floor(totalMinutes / 60) > 0 ? `${Math.floor(totalMinutes / 60)}h ` : ''}{totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ''}
              </p>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section, si) => (
              <div key={section.id}>
                {/* Section header */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                    {si + 1}. {section.title}
                  </span>
                </div>
                {section.description && (
                  <p className="text-sm text-gray-600 mb-3 ml-6">{section.description}</p>
                )}

                {/* Section documents */}
                {(section.agenda_document_links?.length ?? 0) > 0 && (
                  <div className="mb-3 ml-6">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {section.agenda_document_links!.map(l => (
                        <span key={l.document_id} className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
                          <FileText size={11} /> {l.documents.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items */}
                {section.agenda_items.length > 0 && (
                  <div className="ml-6 space-y-4">
                    {section.agenda_items.map((item, ii) => (
                      <div key={item.id}>
                        <div className="flex items-baseline justify-between">
                          <span className="font-semibold text-gray-800">
                            {si + 1}.{ii + 1} {item.title}
                          </span>
                          {item.duration_minutes && (
                            <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0 ml-2">
                              <Clock size={11} /> {item.duration_minutes}m
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                        )}

                        {/* Item documents */}
                        {(item.agenda_document_links?.length ?? 0) > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {item.agenda_document_links!.map(l => (
                              <span key={l.document_id} className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded px-2 py-0.5 text-gray-500">
                                <FileText size={10} /> {l.documents.title}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Sub-items */}
                        {item.agenda_sub_items.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1.5 border-l-2 border-gray-100 pl-3">
                            {item.agenda_sub_items.map((sub, subi) => (
                              <div key={sub.id}>
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium text-gray-500 mr-1">{si + 1}.{ii + 1}.{subi + 1}</span>
                                  {sub.title}
                                </p>
                                {sub.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
                                )}
                                {(sub.agenda_document_links?.length ?? 0) > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {sub.agenda_document_links!.map(l => (
                                      <span key={l.document_id} className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-400">
                                        <FileText size={9} /> {l.documents.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {si < sections.length - 1 && <hr className="mt-8 border-gray-100" />}
              </div>
            ))}
          </div>

          {sections.length === 0 && (
            <p className="text-center text-gray-400 py-16">No agenda items have been added yet.</p>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">Jarrell ISD Foundation Board Â· Published Agenda</p>
          </div>
        </div>
      </div>
    </>
  )
}
