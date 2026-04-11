import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Deep search across meetings, agenda content, and attached documents.
 *
 * Searches: meeting title, meeting location, agenda section titles/descriptions,
 * agenda item titles/descriptions, agenda sub-item titles/descriptions,
 * and file names of documents attached at any agenda level.
 *
 * Returns meeting IDs with match context (what matched and where).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pattern = `%${query}%`;

    // 1. Search meeting titles and locations directly
    const { data: meetingMatches } = await supabase
      .from('meetings')
      .select('id, title')
      .or(`title.ilike.${pattern},location.ilike.${pattern},minutes.ilike.${pattern}`)
      .order('date', { ascending: false });

    // 2. Search agenda sections
    const { data: sectionMatches } = await supabase
      .from('agenda_sections')
      .select('id, meeting_id, title, description')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`);

    // 3. Search agenda items (join through sections to get meeting_id)
    const { data: itemMatches } = await supabase
      .from('agenda_items')
      .select('id, title, description, section:agenda_sections(meeting_id)')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`);

    // 4. Search agenda sub-items (join through items → sections to get meeting_id)
    const { data: subItemMatches } = await supabase
      .from('agenda_sub_items')
      .select('id, title, description, item:agenda_items(section:agenda_sections(meeting_id))')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`);

    // 5. Search documents by file name and title, then find which meetings they're linked to
    const { data: docMatches } = await supabase
      .from('documents')
      .select('id, title, file_name')
      .or(`title.ilike.${pattern},file_name.ilike.${pattern}`);

    // For matched documents, find their agenda links to get meeting IDs
    const docIds = (docMatches || []).map(d => d.id);
    let docLinkMap: Record<string, { meeting_id: string; entity_type: string }[]> = {};

    if (docIds.length > 0) {
      const { data: docLinks } = await supabase
        .from('agenda_document_links')
        .select('document_id, entity_type, entity_id')
        .in('document_id', docIds);

      if (docLinks && docLinks.length > 0) {
        // Resolve entity_ids to meeting_ids based on entity_type
        const sectionIds = docLinks.filter(l => l.entity_type === 'section').map(l => l.entity_id);
        const itemIds = docLinks.filter(l => l.entity_type === 'item').map(l => l.entity_id);
        const subItemIds = docLinks.filter(l => l.entity_type === 'sub_item').map(l => l.entity_id);

        // Resolve sections → meeting_id
        let sectionToMeeting: Record<string, string> = {};
        if (sectionIds.length > 0) {
          const { data: sections } = await supabase
            .from('agenda_sections')
            .select('id, meeting_id')
            .in('id', sectionIds);
          (sections || []).forEach(s => { sectionToMeeting[s.id] = s.meeting_id; });
        }

        // Resolve items → section → meeting_id
        let itemToMeeting: Record<string, string> = {};
        if (itemIds.length > 0) {
          const { data: items } = await supabase
            .from('agenda_items')
            .select('id, section:agenda_sections(meeting_id)')
            .in('id', itemIds);
          (items || []).forEach((i: any) => {
            if (i.section?.meeting_id) itemToMeeting[i.id] = i.section.meeting_id;
          });
        }

        // Resolve sub_items → item → section → meeting_id
        let subItemToMeeting: Record<string, string> = {};
        if (subItemIds.length > 0) {
          const { data: subItems } = await supabase
            .from('agenda_sub_items')
            .select('id, item:agenda_items(section:agenda_sections(meeting_id))')
            .in('id', subItemIds);
          (subItems || []).forEach((si: any) => {
            if (si.item?.section?.meeting_id) subItemToMeeting[si.id] = si.item.section.meeting_id;
          });
        }

        // Build mapping: document_id → [{ meeting_id, entity_type }]
        for (const link of docLinks) {
          let meetingId: string | undefined;
          if (link.entity_type === 'section') meetingId = sectionToMeeting[link.entity_id];
          else if (link.entity_type === 'item') meetingId = itemToMeeting[link.entity_id];
          else if (link.entity_type === 'sub_item') meetingId = subItemToMeeting[link.entity_id];

          if (meetingId) {
            if (!docLinkMap[link.document_id]) docLinkMap[link.document_id] = [];
            docLinkMap[link.document_id].push({ meeting_id: meetingId, entity_type: link.entity_type });
          }
        }
      }

      // Also check documents directly linked to meetings via meeting_id column
      for (const doc of docMatches || []) {
        const { data: directDoc } = await supabase
          .from('documents')
          .select('meeting_id')
          .eq('id', doc.id)
          .not('meeting_id', 'is', null)
          .single();

        if (directDoc?.meeting_id) {
          if (!docLinkMap[doc.id]) docLinkMap[doc.id] = [];
          docLinkMap[doc.id].push({ meeting_id: directDoc.meeting_id, entity_type: 'meeting' });
        }
      }
    }

    // Build unified results: meeting_id → match contexts
    const resultMap: Record<string, { meetingId: string; matches: { type: string; text: string }[] }> = {};

    const addMatch = (meetingId: string, type: string, text: string) => {
      if (!resultMap[meetingId]) {
        resultMap[meetingId] = { meetingId, matches: [] };
      }
      // Avoid duplicate match text
      if (!resultMap[meetingId].matches.some(m => m.text === text && m.type === type)) {
        resultMap[meetingId].matches.push({ type, text });
      }
    };

    // Meeting title/location matches
    for (const m of meetingMatches || []) {
      addMatch(m.id, 'meeting', m.title);
    }

    // Section matches
    for (const s of sectionMatches || []) {
      addMatch(s.meeting_id, 'section', s.title);
    }

    // Item matches
    for (const i of (itemMatches || []) as any[]) {
      const meetingId = i.section?.meeting_id;
      if (meetingId) addMatch(meetingId, 'item', i.title);
    }

    // Sub-item matches
    for (const si of (subItemMatches || []) as any[]) {
      const meetingId = si.item?.section?.meeting_id;
      if (meetingId) addMatch(meetingId, 'sub_item', si.title);
    }

    // Document matches
    for (const doc of docMatches || []) {
      const links = docLinkMap[doc.id] || [];
      for (const link of links) {
        addMatch(link.meeting_id, 'document', doc.file_name || doc.title);
      }
    }

    return NextResponse.json({ results: Object.values(resultMap) });
  } catch (error: any) {
    console.error('Meeting search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
