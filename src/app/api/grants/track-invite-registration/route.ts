import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inviteToken, applicationToken, userId } = body;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Track personal email invite registration
    if (inviteToken) {
      const { error } = await supabaseAdmin
        .from('grant_applicant_invites')
        .update({
          status: 'registered',
          registered_at: new Date().toISOString(),
        })
        .eq('invite_token', inviteToken);

      if (error) {
        console.error('Error updating applicant invite:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true, type: 'applicant_invite' });
    }

    // Track shareable application link usage
    if (applicationToken) {
      const { data: invite, error: fetchError } = await supabaseAdmin
        .from('grant_application_invites')
        .select('id, use_count')
        .eq('invite_token', applicationToken)
        .eq('is_active', true)
        .single();

      if (fetchError || !invite) {
        return Response.json({ error: 'Invite link not found' }, { status: 404 });
      }

      const { error } = await supabaseAdmin
        .from('grant_application_invites')
        .update({ use_count: (invite.use_count || 0) + 1 })
        .eq('id', invite.id);

      if (error) {
        console.error('Error updating invite use count:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true, type: 'application_invite' });
    }

    return Response.json({ error: 'inviteToken or applicationToken required' }, { status: 400 });
  } catch (error) {
    console.error('Error tracking invite registration:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
