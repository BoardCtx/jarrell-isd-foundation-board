import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Fetch agenda structure with sections, items, and sub-items
 */
async function fetchAgendaStructure(
  supabase: any,
  meetingId: string
): Promise<{
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    items: Array<{
      id: string;
      title: string;
      description?: string;
      duration_minutes?: number;
      subItems: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  }>;
}> {
  // Fetch agenda sections
  const { data: sections } = await supabase
    .from('agenda_sections')
    .select('id, title, description')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true });

  const structuredSections = [];

  if (sections && sections.length > 0) {
    for (const section of sections) {
      // Fetch items for this section
      const { data: items } = await supabase
        .from('agenda_items')
        .select('id, title, description, duration_minutes')
        .eq('section_id', section.id)
        .order('sort_order', { ascending: true });

      const structuredItems = [];

      if (items && items.length > 0) {
        for (const item of items) {
          // Fetch sub-items for this item
          const { data: subItems } = await supabase
            .from('agenda_sub_items')
            .select('id, title, description')
            .eq('item_id', item.id)
            .order('sort_order', { ascending: true });

          structuredItems.push({
            id: item.id,
            title: item.title,
            description: item.description,
            duration_minutes: item.duration_minutes,
            subItems: (subItems || []).map((si: any) => ({
              id: si.id,
              title: si.title,
              description: si.description,
            })),
          });
        }
      }

      structuredSections.push({
        id: section.id,
        title: section.title,
        description: section.description,
        items: structuredItems,
      });
    }
  }

  return { sections: structuredSections };
}

/**
 * Generate PDF using Python and reportlab
 */
async function generatePdfWithPython(agendaData: any, meetingTitle: string, meetingDate: string, meetingTime: string | null, meetingLocation: string | null, meetingTimezone: string): Promise<Buffer> {
  const tmpDir = tmpdir();
  const dataFile = join(tmpDir, `agenda_${Date.now()}_data.json`);
  const scriptFile = join(tmpDir, `agenda_${Date.now()}_script.py`);
  const pdfFile = join(tmpDir, `agenda_${Date.now()}.pdf`);

  try {
    // Write agenda data to JSON file
    const dataPayload = {
      title: meetingTitle,
      date: meetingDate,
      time: meetingTime,
      timezone: meetingTimezone,
      location: meetingLocation,
      agenda: agendaData,
    };
    writeFileSync(dataFile, JSON.stringify(dataPayload, null, 2));

    // Generate Python script
    const pythonScript = `#!/usr/bin/env python3
import json
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Read agenda data
with open('${dataFile}', 'r') as f:
    data = json.load(f)

# Create PDF
doc = SimpleDocTemplate('${pdfFile}', pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=24,
    textColor='#000000',
    spaceAfter=6,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold',
)

meeting_header_style = ParagraphStyle(
    'MeetingHeader',
    parent=styles['Normal'],
    fontSize=14,
    textColor='#000000',
    spaceAfter=3,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold',
)

meeting_details_style = ParagraphStyle(
    'MeetingDetails',
    parent=styles['Normal'],
    fontSize=11,
    textColor='#333333',
    spaceAfter=12,
    alignment=TA_CENTER,
)

section_style = ParagraphStyle(
    'SectionTitle',
    parent=styles['Heading2'],
    fontSize=14,
    textColor='#000000',
    spaceAfter=6,
    spaceBefore=8,
    fontName='Helvetica-Bold',
)

item_style = ParagraphStyle(
    'ItemTitle',
    parent=styles['Normal'],
    fontSize=11,
    textColor='#000000',
    spaceAfter=3,
    spaceBefore=3,
    leftIndent=0.2*inch,
    fontName='Helvetica-Bold',
)

item_desc_style = ParagraphStyle(
    'ItemDescription',
    parent=styles['Normal'],
    fontSize=10,
    textColor='#444444',
    spaceAfter=6,
    leftIndent=0.4*inch,
)

subitem_style = ParagraphStyle(
    'SubItemTitle',
    parent=styles['Normal'],
    fontSize=10,
    textColor='#000000',
    spaceAfter=2,
    leftIndent=0.4*inch,
    fontName='Helvetica',
)

subitem_desc_style = ParagraphStyle(
    'SubItemDescription',
    parent=styles['Normal'],
    fontSize=9,
    textColor='#555555',
    spaceAfter=4,
    leftIndent=0.6*inch,
)

footer_style = ParagraphStyle(
    'Footer',
    parent=styles['Normal'],
    fontSize=9,
    textColor='#666666',
    spaceAfter=0,
    alignment=TA_CENTER,
)

# Build content
story = []

# Header: Organization name
story.append(Paragraph('Jarrell ISD Foundation', meeting_header_style))
story.append(Spacer(1, 0.1*inch))

# Meeting title
story.append(Paragraph(data['title'], title_style))
story.append(Spacer(1, 0.2*inch))

# Meeting details
details = []
details.append(data['date'])
if data['time']:
    details.append(data['time'])
if data['timezone']:
    details.append(f"({data['timezone']})")
if data['location']:
    details.append(f"Location: {data['location']}")

meeting_details = ' | '.join(details)
story.append(Paragraph(meeting_details, meeting_details_style))
story.append(Spacer(1, 0.3*inch))

# Agenda sections
for section_idx, section in enumerate(data['agenda']['sections'], 1):
    section_title = f"{section_idx}. {section['title']}"
    story.append(Paragraph(section_title, section_style))

    if section.get('description'):
        story.append(Paragraph(section['description'], item_desc_style))

    for item_idx, item in enumerate(section.get('items', []), 1):
        item_title = f"{section_idx}.{item_idx}. {item['title']}"
        if item.get('duration_minutes'):
            item_title += f" ({item['duration_minutes']} min)"
        story.append(Paragraph(item_title, item_style))

        if item.get('description'):
            story.append(Paragraph(item['description'], item_desc_style))

        for subitem_idx, subitem in enumerate(item.get('subItems', []), 1):
            subitem_title = f"{section_idx}.{item_idx}.{subitem_idx}. {subitem['title']}"
            story.append(Paragraph(subitem_title, subitem_style))

            if subitem.get('description'):
                story.append(Paragraph(subitem['description'], subitem_desc_style))

    story.append(Spacer(1, 0.15*inch))

# Footer
story.append(Spacer(1, 0.2*inch))
story.append(Paragraph('Jarrell ISD Foundation Board · Published Agenda', footer_style))

# Build PDF
doc.build(story)
print('PDF generated successfully')
`;

    writeFileSync(scriptFile, pythonScript);

    // Try to install reportlab if not already installed
    try {
      await execAsync('pip install reportlab --break-system-packages', { timeout: 60000 });
    } catch (err) {
      // reportlab might already be installed, continue
      console.log('Reportlab install check completed');
    }

    // Run Python script
    await execAsync(`python3 "${scriptFile}"`, { timeout: 30000 });

    // Read the generated PDF
    if (!existsSync(pdfFile)) {
      throw new Error('PDF file was not generated');
    }

    const pdfBuffer = readFileSync(pdfFile);
    return pdfBuffer;
  } finally {
    // Cleanup temp files
    [dataFile, scriptFile, pdfFile].forEach(file => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (err) {
        console.error(`Failed to delete temp file ${file}:`, err);
      }
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

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

    // Fetch meeting details
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, title, date, time, location, time_zone')
      .eq('id', meetingId)
      .single();

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Fetch agenda structure
    const agendaStructure = await fetchAgendaStructure(supabase, meetingId);

    // Generate PDF
    const pdfBuffer = await generatePdfWithPython(
      agendaStructure,
      meeting.title,
      meeting.date,
      meeting.time,
      meeting.location,
      meeting.time_zone || 'America/Chicago'
    );

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="meeting-agenda.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Generate agenda PDF error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
