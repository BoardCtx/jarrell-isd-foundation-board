import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicationId, expiresAt, maxUses, createdBy } = body;

    if (!applicationId) {
      return Response.json({ error: 'applicationId is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabaseAdmin
      .from('grant_application_invites')
      .insert({
        application_id: applicationId,
        created_by: createdBy || null,
        expires_at: expiresAt || null,
        max_uses: maxUses || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, invite: data });
  } catch (error) {
    console.error('Error creating invite link:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get('applicationId');
    const token = url.searchParams.get('token');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Look up by token (for public landing pages)
    if (token) {
      const { data, error } = await supabaseAdmin
        .from('grant_application_invites')
        .select('*, grant_applications(id, title, description, status, deadline)')
        .eq('invite_token', token)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return Response.json({ error: 'Invalid or expired invite link' }, { status: 404 });
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return Response.json({ error: 'This invite link has expired' }, { status: 410 });
      }

      // Check max uses
      if (data.max_uses && data.use_count >= data.max_uses) {
        return Response.json({ error: 'This invite link has reached its maximum uses' }, { status: 410 });
      }

      return Response.json({ invite: data });
    }

    // List invites for an application (admin)
    if (applicationId) {
      const { data, error } = await supabaseAdmin
        .from('grant_application_invites')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ invites: data });
    }

    return Response.json({ error: 'applicationId or token required' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { inviteId } = body;

    if (!inviteId) {
      return Response.json({ error: 'inviteId is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { error } = await supabaseAdmin
      .from('grant_application_invites')
      .update({ is_active: false })
      .eq('id', inviteId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
