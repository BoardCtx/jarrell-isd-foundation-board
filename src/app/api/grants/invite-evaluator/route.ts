import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, full_name } = body;

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Check if evaluator already exists
    const { data: existing } = await supabaseAdmin
      .from('grant_evaluators')
      .select('id, status')
      .eq('email', email)
      .single();

    if (existing) {
      return Response.json(
        { error: `An evaluator with this email already exists (status: ${existing.status})` },
        { status: 409 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const registerUrl = `${baseUrl}/grants/evaluator/register?email=${encodeURIComponent(email)}${full_name ? `&name=${encodeURIComponent(full_name)}` : ''}`;

    // Send invitation email
    const emailResult = await sendEmail({
      to: [email],
      subject: 'Invitation to Join as a Grant Evaluator - Jarrell ISD Foundation',
      html: `
        <h2>Grant Evaluator Invitation</h2>
        <p>Hello${full_name ? ` ${full_name}` : ''},</p>
        <p>You have been invited to serve as an external evaluator for the Jarrell ISD Education Foundation's grant review process.</p>
        <p>Please click the button below to create your evaluator account:</p>
        <p>
          <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
            Create Evaluator Account
          </a>
        </p>
        <p>After registering, your account will be reviewed and approved by the grant administrator. You will receive a confirmation email once approved.</p>
        <p>If you have any questions, please contact the foundation administrators.</p>
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
    });
  } catch (error) {
    console.error('Error in invite-evaluator:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
