import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

interface RequestBody {
  applicationId: string;
  requestIds: string[];
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { applicationId, requestIds } = body;

    if (!applicationId || !requestIds || requestIds.length === 0) {
      return Response.json(
        { error: 'applicationId and requestIds are required' },
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

    // Get requests with applicant info
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from('grant_requests')
      .select('id, applicant_id, status, awarded_amount')
      .in('id', requestIds);

    if (requestsError) throw requestsError;
    if (!requests || requests.length === 0) {
      return Response.json(
        { error: 'No valid requests found' },
        { status: 404 }
      );
    }

    // Get applicant details
    const applicantIds = requests.map(r => r.applicant_id);
    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from('grant_applicants')
      .select('id, full_name, email')
      .in('id', applicantIds);

    if (applicantsError) throw applicantsError;

    const applicantMap: Record<string, any> = {};
    (applicants || []).forEach(a => {
      applicantMap[a.id] = a;
    });

    // Send emails to applicants
    const emailPromises = requests.map(req => {
      const applicant = applicantMap[req.applicant_id];
      if (!applicant?.email) return null;

      const statusLabel = req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Partial Funding';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const requestUrl = `${baseUrl}/grants/applications/${applicationId}/request/${req.id}`;

      const html = `
        <h2>Grant Application Decision</h2>
        <p>Dear ${applicant.full_name},</p>
        <p>We are pleased to inform you of the decision on your grant request for <strong>${application.title}</strong>.</p>
        <p style="margin: 20px 0;">
          <strong>Decision: ${statusLabel}</strong>
          ${req.awarded_amount ? `<br />Award Amount: $${req.awarded_amount.toFixed(2)}` : ''}
        </p>
        <p>
          <a href="${requestUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
            View Decision Details
          </a>
        </p>
        <p>If you have any questions, please contact the foundation.</p>
      `;

      return sendEmail({
        to: applicant.email,
        subject: `Grant Decision: ${application.title}`,
        html,
      });
    });

    const results = await Promise.all(emailPromises.filter(Boolean));
    const successCount = results.filter(r => r.success).length;

    if (successCount === 0) {
      return Response.json(
        { error: 'Failed to send notification emails' },
        { status: 500 }
      );
    }

    // Log notifications
    const applicantIds_unique = [...new Set(requests.map(r => r.applicant_id))];
    const { error: logError } = await supabaseAdmin
      .from('grant_notifications')
      .insert({
        application_id: applicationId,
        notification_type: 'decision_made',
        sent_to: applicantIds_unique,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Failed to log notification:', logError);
      // Don't fail the entire request if logging fails
    }

    return Response.json({
      success: true,
      message: `Notifications sent to ${successCount} applicant(s)`,
      recipientCount: successCount,
    });
  } catch (error) {
    console.error('Error in notify-applicants:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
