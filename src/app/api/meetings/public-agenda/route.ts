import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const meetingId = searchParams.get('meetingId')
  const token = searchParams.get('token')

  if (!meetingId || !token) {
    return NextResponse.json({ error: 'Missing meetingId or token' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch meeting and validate token
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, title, date, time, location, time_zone, agenda_published, public_token')
    .eq('id', meetingId)
    .single()

  if (meetingError || !meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  if (!meeting.agenda_published || meeting.public_token !== token) {
    return NextResponse.json({ error: 'This agenda is not available or the link is invalid.' }, { status: 403 })
  }

  // Fetch sections, items, sub-items (no documents for public view)
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

  const sections = (sectionsData || []).map((s: any) => ({
    ...s,
    agenda_items: (s.agenda_items || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((item: any) => ({
        ...item,
        agenda_sub_items: (item.agenda_sub_items || []).sort((a: any, b: any) => a.position - b.position),
      })),
  }))

  return NextResponse.json({ meeting, sections })
}
