import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicationId, email, fullName, invitedBy } = body;

    if (!applicationId || !email) {
      return Response.json({ error: 'applicationId and email are required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get application details
    const { data: app } = await supabaseAdmin
      .from('grant_applications')
      .select('title, deadline')
      .eq('id', applicationId)
      .single();

    if (!app) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Create the invite record
    const { data: invite, error: insertError } = await supabaseAdmin
      .from('grant_applicant_invites')
      .insert({
        application_id: applicationId,
        email,
        full_name: fullName || null,
        invited_by: invitedBy || null,
        status: 'sent',
      })
      .select()
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // Send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const registerUrl = `${baseUrl}/grants/register?invite=${invite.invite_token}&email=${encodeURIComponent(email)}${fullName ? `&name=${encodeURIComponent(fullName)}` : ''}`;

    const deadlineText = app.deadline
      ? `The deadline to apply is ${new Date(app.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
      : '';

    const emailResult = await sendEmail({
      to: [email],
      subject: `You're Invited to Apply: ${app.title} - Jarrell ISD Foundation`,
      html: `
        <h2>Grant Application Invitation</h2>
        <p>Hello${fullName ? ` ${fullName}` : ''},</p>
        <p>You have been invited to apply for the <strong>${app.title}</strong> grant from the Jarrell ISD Education Foundation.</p>
        ${deadlineText ? `<p>${deadlineText}</p>` : ''}
        <p>Click the button below to create your account and start your application:</p>
        <p>
          <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e3a5f; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
            Apply Now
          </a>
        </p>
        <p>If you already have an account, you can <a href="${baseUrl}/grants/login">sign in here</a>.</p>
      `,
    });

    if (!emailResult.success) {
      return Response.json(
        { error: 'Failed to send invitation email', details: emailResult.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: `Invitation sent to ${email}`,
      invite,
    });
  } catch (error) {
    console.error('Error in send-applicant-invite:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
