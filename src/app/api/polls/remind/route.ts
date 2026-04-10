import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pollId } = await request.json();

    // Verify authenticated user is the poll creator
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check poll exists and user is creator
    const { data: poll } = await supabase
      .from('polls')
      .select('id, title, created_by')
      .eq('id', pollId)
      .single();

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    if (poll.created_by !== user.id) {
      return NextResponse.json({ error: 'Only the poll creator can send reminders' }, { status: 403 });
    }

    // Get recipients who have NOT voted
    const { data: allRecipients } = await supabase
      .from('poll_recipients')
      .select('profile_id')
      .eq('poll_id', pollId);

    const { data: votes } = await supabase
      .from('poll_votes')
      .select('voter_id')
      .eq('poll_id', pollId);

    const voterIds = new Set((votes || []).map(v => v.voter_id));
    const nonVoterIds = (allRecipients || [])
      .map(r => r.profile_id)
      .filter(id => !voterIds.has(id));

    if (nonVoterIds.length === 0) {
      return NextResponse.json({ message: 'Everyone has already voted!' });
    }

    // Get non-voter details
    const { data: nonVoters } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', nonVoterIds);

    if (!nonVoters || nonVoters.length === 0) {
      return NextResponse.json({ message: 'No non-voters found' });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jarrell-isd-foundation-board.vercel.app';
    const pollUrl = `${siteUrl}/polls?id=${pollId}`;

    // Send reminder to each non-voter
    const results = [];
    for (const person of nonVoters) {
      try {
        await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: person.email,
          options: {
            redirectTo: pollUrl,
          },
        });

        // Update reminded_at timestamp
        await supabase
          .from('poll_recipients')
          .update({ reminded_at: new Date().toISOString() })
          .eq('poll_id', pollId)
          .eq('profile_id', person.id);

        results.push({ email: person.email, success: true });
      } catch (e: any) {
        results.push({ email: person.email, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, reminded: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
