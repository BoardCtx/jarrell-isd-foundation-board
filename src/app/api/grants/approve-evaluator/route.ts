import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, evaluatorId, evaluator_name, evaluator_email } = body;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // ── Notify admins about a pending evaluator registration ────────
    if (action === 'notify_pending') {
      // Get all grant admins
      const { data: adminProfiles } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .in('role', ['admin', 'president']);

      // Also get Grant Admin group members
      const { data: grantAdminGroup } = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('name', 'Grant Admin')
        .single();

      let groupEmails: string[] = [];
      if (grantAdminGroup) {
        const { data: groupMembers } = await supabaseAdmin
          .from('group_members')
          .select('profiles(email)')
          .eq('group_id', grantAdminGroup.id);

        groupEmails = (groupMembers || [])
          .map((m: any) => m.profiles?.email)
          .filter(Boolean);
      }

      const adminEmails = [
        ...(adminProfiles || []).map(p => p.email),
        ...groupEmails,
      ].filter((v, i, a) => a.indexOf(v) === i);

      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: `New Evaluator Registration Pending Approval: ${evaluator_name}`,
          html: `
            <h2>New Evaluator Registration</h2>
            <p>A new external evaluator has registered and is pending your approval:</p>
            <ul>
              <li><strong>Name:</strong> ${evaluator_name}</li>
              <li><strong>Email:</strong> ${evaluator_email}</li>
            </ul>
            <p>Please visit the Evaluator Management page to review and approve or reject this request:</p>
            <p>
              <a href="${baseUrl}/grants/evaluators" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
                Review Evaluators
              </a>
            </p>
          `,
        });
      }

      return Response.json({ success: true });
    }

    // ── Approve an evaluator ────────────────────────────────────────
    if (action === 'approve') {
      if (!evaluatorId) {
        return Response.json({ error: 'evaluatorId is required' }, { status: 400 });
      }

      const { data: evaluator, error: evalError } = await supabaseAdmin
        .from('grant_evaluators')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', evaluatorId)
        .select('email, full_name')
        .single();

      if (evalError || !evaluator) {
        return Response.json({ error: 'Failed to approve evaluator' }, { status: 500 });
      }

      // Send approval email
      await sendEmail({
        to: [evaluator.email],
        subject: 'Your Evaluator Account Has Been Approved',
        html: `
          <h2>Account Approved</h2>
          <p>Hello ${evaluator.full_name},</p>
          <p>Your evaluator account for the Jarrell ISD Foundation has been approved. You can now sign in to the Evaluator Portal to review assigned grant applications.</p>
          <p>
            <a href="${baseUrl}/grants/evaluator/login" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
              Sign In to Evaluator Portal
            </a>
          </p>
        `,
      });

      return Response.json({ success: true, message: `${evaluator.full_name} has been approved` });
    }

    // ── Reject an evaluator ─────────────────────────────────────────
    if (action === 'reject') {
      if (!evaluatorId) {
        return Response.json({ error: 'evaluatorId is required' }, { status: 400 });
      }

      const { data: evaluator, error: evalError } = await supabaseAdmin
        .from('grant_evaluators')
        .update({ status: 'rejected' })
        .eq('id', evaluatorId)
        .select('email, full_name')
        .single();

      if (evalError || !evaluator) {
        return Response.json({ error: 'Failed to reject evaluator' }, { status: 500 });
      }

      return Response.json({ success: true, message: `${evaluator.full_name} has been rejected` });
    }

    // ── Suspend an evaluator ────────────────────────────────────────
    if (action === 'suspend') {
      if (!evaluatorId) {
        return Response.json({ error: 'evaluatorId is required' }, { status: 400 });
      }

      const { error: evalError } = await supabaseAdmin
        .from('grant_evaluators')
        .update({ status: 'suspended' })
        .eq('id', evaluatorId);

      if (evalError) {
        return Response.json({ error: 'Failed to suspend evaluator' }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in approve-evaluator:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
