'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Clock, Printer, AlertTriangle, Info } from 'lucide-react'

interface SubItem {
  id: string; title: string; description: string | null; position: number
}
interface Item {
  id: string; title: string; description: string | null; duration_minutes: number | null; position: number
  agenda_sub_items: SubItem[]
}
interface Section {
  id: string; title: string; description: string | null; position: number
  agenda_items: Item[]
}
interface Meeting {
  id: string; title: string; date: string; time: string | null; location: string | null
  time_zone: string | null; agenda_published: boolean; public_token: string | null
}

export default function PublicAgendaPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()
  const meetingId = params.id as string
  const token = searchParams.get('token')

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!token) {
        setError('No access token provided.')
        setLoading(false)
        return
      }

      const { data: meetingData } = await supabase
        .from('meetings')
        .select('id, title, date, time, location, time_zone, agenda_published, public_token')
        .eq('id', meetingId)
        .single()

      if (!meetingData) {
        setError('Meeting not found.')
        setLoading(false)
        return
      }

      if (!meetingData.agenda_published || meetingData.public_token !== token) {
        setError('This agenda is not available or the link is invalid.')
        setLoading(false)
        return
      }

      setMeeting(meetingData)

      // Fetch sections, items, sub-items — NO documents
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

      const secs = (sectionsData || []).map((s: any) => ({
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

      // Auto-trigger print dialog if ?print=1
      if (searchParams.get('print') === '1') {
        setTimeout(() => window.print(), 500)
      }
    }

    load()
  }, [meetingId, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500">{error}</p>
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

  const tzLabel = meeting?.time_zone?.replace(/_/g, ' ').split('/').pop() || ''

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
        {/* Toolbar */}
        <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">Public Agenda View</p>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Info size={11} /> Text only — attachments available to logged-in members
            </span>
          </div>
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
              {meeting?.time && <span>· {meeting.time}{tzLabel ? ` (${tzLabel})` : ''}</span>}
              {meeting?.location && <span>· {meeting.location}</span>}
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
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                    {si + 1}. {section.title}
                  </span>
                </div>
                {section.description && (
                  <p className="text-sm text-gray-600 mb-3 ml-6">{section.description}</p>
                )}

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
            <p className="text-xs text-gray-400">
              Jarrell ISD Foundation Board · Public Agenda
            </p>
            <p className="text-xs text-gray-300 mt-1">
              This is the public text-only version. Supporting documents and attachments are available to board members upon login.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
