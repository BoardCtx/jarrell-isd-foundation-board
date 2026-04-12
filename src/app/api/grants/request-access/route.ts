import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    // Verify authenticated user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user's profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Fetch all admin and president profiles
    const { data: admins } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('role', ['admin', 'president']);

    if (!admins || admins.length === 0) {
      return NextResponse.json(
        { error: 'No administrators found to notify' },
        { status: 500 }
      );
    }

    // Send emails to all admins
    const adminEmails = admins.map(admin => admin.email);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jarrell-isd-foundation-board.vercel.app';
    const grantsUrl = `${siteUrl}/grants`;

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .message { font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
    .info-box strong { color: #667eea; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }
    .footer { color: #6b7280; font-size: 12px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Grant Portal Access Request</h1>
    </div>
    <div class="content">
      <p class="message">Hello,</p>

      <p class="message">${userProfile.full_name} is requesting access to the Grant Portal.</p>

      <div class="info-box">
        <strong>Requester Information</strong><br>
        Name: ${userProfile.full_name}<br>
        Email: ${userProfile.email}
      </div>

      <p class="message">Please review this request and grant the appropriate access to the Grant Portal. You can manage group memberships in the Foundation Admin Dashboard.</p>

      <a href="${grantsUrl}" class="button">View Grants Portal</a>

      <p class="message">Best regards,<br>Jarrell ISD Foundation</p>
    </div>
    <div class="footer">
      <p>This is an automated email from the Jarrell ISD Foundation Board Portal. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: adminEmails,
      subject: `Grant Portal Access Request from ${userProfile.full_name}`,
      html: htmlEmail,
      text: `${userProfile.full_name} is requesting access to the Grant Portal. Email: ${userProfile.email}`,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send request email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access request sent to administrators',
    });
  } catch (err) {
    console.error('[grants] request-access error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
