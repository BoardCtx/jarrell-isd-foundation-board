import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/**
 * Generates a nanoid-style random token (21 chars, alphanumeric)
 */
function generatePublicToken(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let token = '';
  const bytes = randomBytes(18); // ~18 bytes gives ~21 base64 chars
  for (let i = 0; i < 21; i++) {
    token += chars[bytes[Math.floor(i * bytes.length / 21)] % chars.length];
  }
  return token;
}

/**
 * Format time as HHmmss
 */
function formatTimeHHmmss(timeStr: string | null): string {
  if (!timeStr) return '000000';
  const [hours, minutes] = timeStr.split(':').map(Number);
  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
}

/**
 * Format date as YYYYMMDD
 */
function formatDateYYYYMMDD(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${year}${month}${day}`;
}

/**
 * Generate iCalendar (.ics) content for the meeting
 */
function generateIcsContent(
  meetingId: string,
  title: string,
  date: string,
  time: string | null,
  timezone: string,
  location: string | null,
  agendaViewUrl: string,
  agendaText: string
): string {
  const dateFormatted = formatDateYYYYMMDD(date);
  const timeFormatted = formatTimeHHmmss(time);

  // Calculate end time (1 hour after start time by default)
  const [hours, minutes] = (time || '00:00').split(':').map(Number);
  const endHours = (hours + 1) % 24;
  const endTimeFormatted = `${String(endHours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;

  const description = `View agenda: ${agendaViewUrl}\n\nAgenda:\n${agendaText}`;
  const escapedDescription = description.replace(/\n/g, '\\n').replace(/,/g, '\\,');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jarrell ISD Foundation//Meeting//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${meetingId}@jarrell-isd-foundation
DTSTART;TZID=${timezone}:${dateFormatted}T${timeFormatted}
DTEND;TZID=${timezone}:${dateFormatted}T${endTimeFormatted}
SUMMARY:${title}
${location ? `LOCATION:${location}` : ''}
DESCRIPTION:${escapedDescription}
END:VEVENT
END:VCALENDAR`;
}

/**
 * Build agenda text from sections, items, and sub-items
 */
async function buildAgendaText(
  supabase: any,
  meetingId: string
): Promise<string> {
  // Fetch agenda sections
  const { data: sections } = await supabase
    .from('agenda_sections')
    .select('id, title, description')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true });

  if (!sections || sections.length === 0) {
    return '';
  }

  let agendaText = '';

  for (let sIndex = 0; sIndex < sections.length; sIndex++) {
    const section = sections[sIndex];
    const sectionNumber = sIndex + 1;

    agendaText += `${sectionNumber}. ${section.title}\n`;
    if (section.description) {
      agendaText += `   ${section.description}\n`;
    }

    // Fetch items for this section
    const { data: items } = await supabase
      .from('agenda_items')
      .select('id, title, description, duration_minutes')
      .eq('section_id', section.id)
      .order('sort_order', { ascending: true });

    if (items && items.length > 0) {
      for (let iIndex = 0; iIndex < items.length; iIndex++) {
        const item = items[iIndex];
        const itemNumber = `${sectionNumber}.${iIndex + 1}`;

        let itemText = `   ${itemNumber}. ${item.title}`;
        if (item.duration_minutes) {
          itemText += ` (${item.duration_minutes} min)`;
        }
        agendaText += itemText + '\n';

        if (item.description) {
          agendaText += `      ${item.description}\n`;
        }

        // Fetch sub-items for this item
        const { data: subItems } = await supabase
          .from('agenda_sub_items')
          .select('id, title, description')
          .eq('item_id', item.id)
          .order('sort_order', { ascending: true });

        if (subItems && subItems.length > 0) {
          for (let siIndex = 0; siIndex < subItems.length; siIndex++) {
            const subItem = subItems[siIndex];
            const subItemNumber = `${itemNumber}.${siIndex + 1}`;

            agendaText += `      ${subItemNumber}. ${subItem.title}\n`;
            if (subItem.description) {
              agendaText += `         ${subItem.description}\n`;
            }
          }
        }
      }
    }

    agendaText += '\n';
  }

  return agendaText;
}

export async function POST(request: Request) {
  try {
    const { meetingId } = await request.json();

    if (!meetingId) {
      return NextResponse.json(
        { error: 'meetingId is required' },
        { status: 400 }
      );
    }

    // Verify the requesting user is authenticated
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, title, date, time, location, time_zone, created_by, public_token')
      .eq('id', meetingId)
      .single();

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Verify caller is admin/president or the meeting creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAuthorized =
      meeting.created_by === user.id ||
      (profile && ['admin', 'president'].includes(profile.role));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Generate or use existing public token
    let publicToken = meeting.public_token;
    if (!publicToken) {
      publicToken = generatePublicToken();
    }

    // Update meeting with public_token and agenda_published
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        public_token: publicToken,
        agenda_published: true,
      })
      .eq('id', meetingId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update meeting: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Fetch all meeting attendees with their profile info
    const { data: attendees } = await supabase
      .from('meeting_attendees')
      .select('profile_id, attendance_type, profiles:profile_id(email, full_name)')
      .eq('meeting_id', meetingId);

    if (!attendees || attendees.length === 0) {
      // No attendees to notify
      const agendaText = await buildAgendaText(supabase, meetingId);
      const icsContent = generateIcsContent(
        meetingId,
        meeting.title,
        meeting.date,
        meeting.time,
        meeting.time_zone || 'America/Chicago',
        meeting.location,
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/meetings/${meetingId}/agenda/view?token=${publicToken}`,
        agendaText
      );

      return NextResponse.json({
        success: true,
        publicToken,
        icsContent,
      });
    }

    // Build agenda text once for all attendees
    const agendaText = await buildAgendaText(supabase, meetingId);

    // Generate magic links and send emails using admin client
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const agendaViewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/meetings/${meetingId}/agenda/view?token=${publicToken}`;
    const icsContent = generateIcsContent(
      meetingId,
      meeting.title,
      meeting.date,
      meeting.time,
      meeting.time_zone || 'America/Chicago',
      meeting.location,
      agendaViewUrl,
      agendaText
    );

    // Track attendee IDs to update notified_at
    const attendeeIdsToNotify: string[] = [];

    // Send emails to each attendee
    for (const attendee of attendees) {
      const attendeeProfile = (attendee as any).profiles;
      if (!attendeeProfile?.email) {
        continue;
      }

      attendeeIdsToNotify.push(attendee.profile_id);

      try {
        // Generate a magic link for this attendee
        const { data, error: magicLinkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: attendeeProfile.email,
          options: {
            redirectTo: agendaViewUrl,
          },
        });

        if (magicLinkError) {
          console.error(`Failed to generate magic link for ${attendeeProfile.email}:`, magicLinkError);
          continue;
        }

        // In a real implementation, you would send an email here using a service like SendGrid, Resend, or similar
        // For now, we're just generating the magic link in the response
        // The frontend can use the agendaViewUrl with the public token instead
        // Note: Supabase auth.admin.generateLink only generates links; it doesn't send emails
        // You would need to integrate with an email service to actually send the email

        console.log(`Magic link generated for ${attendeeProfile.email}: ${data?.properties?.action_link}`);
      } catch (err) {
        console.error(`Error processing attendee ${attendeeProfile.email}:`, err);
      }
    }

    // Update notified_at for all attendees
    if (attendeeIdsToNotify.length > 0) {
      const { error: notifyError } = await supabase
        .from('meeting_attendees')
        .update({ notified_at: new Date().toISOString() })
        .eq('meeting_id', meetingId)
        .in('profile_id', attendeeIdsToNotify);

      if (notifyError) {
        console.error('Failed to update notified_at:', notifyError);
        // Don't fail the entire request; just log the error
      }
    }

    return NextResponse.json({
      success: true,
      publicToken,
      icsContent,
      attendeesNotified: attendeeIdsToNotify.length,
    });
  } catch (err: any) {
    console.error('Publish agenda error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
