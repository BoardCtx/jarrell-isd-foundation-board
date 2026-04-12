import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

interface RequestBody {
  applicationId: string;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { applicationId } = body;

    if (!applicationId) {
      return Response.json(
        { error: 'applicationId is required' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get application details
    const { data: application, error: appError } = await supabaseAdmin
      .from('grant_applications')
      .select('id, title')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      return Response.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Get Grant Committee group
    const { data: committeeGroup, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('name', 'Grant Committee')
      .single();

    if (groupError || !committeeGroup) {
      return Response.json(
        { error: 'Grant Committee group not found' },
        { status: 404 }
      );
    }

    // Get all committee members
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('profile_id, profiles(full_name, email)')
      .eq('group_id', committeeGroup.id);

    if (membersError) {
      throw membersError;
    }

    if (!members || members.length === 0) {
      return Response.json(
        { error: 'No committee members found' },
        { status: 404 }
      );
    }

    // Send emails to all committee members
    const emailAddresses = members
      .filter((m: any) => m.profiles?.email)
      .map((m: any) => m.profiles.email);

    if (emailAddresses.length === 0) {
      return Response.json(
        { error: 'No valid email addresses for committee members' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const reviewUrl = `${baseUrl}/grants/applications/${applicationId}/review`;

    const html = `
      <h2>Grant Requests Ready for Review</h2>
      <p>Grant requests for <strong>${application.title}</strong> are ready for your review.</p>
      <p>Please visit the committee review page to begin scoring:</p>
      <p>
        <a href="${reviewUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Review Requests
        </a>
      </p>
      <p>If you have any questions, please contact the foundation administrators.</p>
    `;

    const emailResult = await sendEmail({
      to: emailAddresses,
      subject: `Grant Requests Ready for Review: ${application.title}`,
      html,
    });

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return Response.json(
        { error: 'Failed to send notification emails', details: emailResult.error },
        { status: 500 }
      );
    }

    // Log notification
    const memberIds = members
      .filter((m: any) => m.profiles?.email && emailAddresses.includes(m.profiles.email))
      .map((m: any) => m.profile_id);

    const { error: logError } = await supabaseAdmin
      .from('grant_notifications')
      .insert({
        application_id: applicationId,
        notification_type: 'scoring_ready',
        sent_to: memberIds,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Failed to log notification:', logError);
      // Don't fail the entire request if logging fails
    }

    return Response.json({
      success: true,
      message: `Notification sent to ${emailAddresses.length} committee member(s)`,
      recipientCount: emailAddresses.length,
    });
  } catch (error) {
    console.error('Error in notify-committee:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
