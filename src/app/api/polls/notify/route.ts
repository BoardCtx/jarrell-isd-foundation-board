import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pollId, recipientIds } = await request.json();

    // Verify authenticated user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get poll details
    const { data: poll } = await supabase
      .from('polls')
      .select('title, description')
      .eq('id', pollId)
      .single();

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Get recipient emails
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', recipientIds);

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    // Use admin client for sending emails via Supabase Auth
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jarrell-isd-foundation-board.vercel.app';
    const pollUrl = `${siteUrl}/polls?id=${pollId}`;

    // Send magic link emails to each recipient as a notification
    // Using Supabase's built-in email sending via magic links
    const results = [];
    for (const recipient of recipients) {
      try {
        // Use the OTP method to send a magic link that also serves as notification
        const { error } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: recipient.email,
          options: {
            redirectTo: pollUrl,
          },
        });

        // Update notified_at timestamp
        await supabase
          .from('poll_recipients')
          .update({ notified_at: new Date().toISOString() })
          .eq('poll_id', pollId)
          .eq('profile_id', recipient.id);

        results.push({ email: recipient.email, success: !error, error: error?.message });
      } catch (e: any) {
        results.push({ email: recipient.email, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
