import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/tasks/notify
 * Send email notifications to task assignees via Resend
 * Body: { taskId, type: 'comment' | 'document', commentBody?, documentName?, documentUrl? }
 */
export async function POST(request: Request) {
  try {
    const { taskId, type, commentBody, documentName, documentUrl } = await request.json()

    if (!taskId || !type) {
      return NextResponse.json({ error: 'taskId and type are required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the task
    const { data: task } = await adminClient
      .from('tasks')
      .select('id, title, created_by')
      .eq('id', taskId)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Fetch the sender's profile
    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.full_name || senderProfile?.email || 'A team member'

    // Fetch all task assignees
    const { data: assignees } = await adminClient
      .from('task_assignees')
      .select('profile_id')
      .eq('task_id', taskId)

    // Collect unique recipient IDs (assignees + creator, minus sender)
    const recipientIds = new Set((assignees || []).map(a => a.profile_id))
    if (task.created_by) recipientIds.add(task.created_by)
    recipientIds.delete(user.id) // don't email the person who triggered this

    if (recipientIds.size === 0) {
      return NextResponse.json({ success: true, notifiedCount: 0 })
    }

    // Fetch recipient profiles
    const { data: recipients } = await adminClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(recipientIds))

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: true, notifiedCount: 0 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let notifiedCount = 0

    for (const recipient of recipients) {
      if (!recipient.email) continue

      let subject = ''
      let bodyHtml = ''

      if (type === 'comment') {
        subject = `New comment on task: ${task.title}`
        bodyHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Jarrell ISD Foundation</p>
              <h2 style="margin: 0; font-size: 18px;">New Comment on Task</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0 0 16px; color: #334155;"><strong>${senderName}</strong> commented on <strong>${task.title}</strong>:</p>
              <div style="background: white; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 0 0 16px;">
                <p style="margin: 0; color: #334155;">${(commentBody || '').replace(/\n/g, '<br/>')}</p>
              </div>
              <div style="text-align: center;">
                <a href="${appUrl}/tasks" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Task</a>
              </div>
            </div>
            <div style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">Jarrell ISD Foundation Board Portal</p>
            </div>
          </div>
        `
      } else if (type === 'document') {
        subject = `New document on task: ${task.title}`
        bodyHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Jarrell ISD Foundation</p>
              <h2 style="margin: 0; font-size: 18px;">New Document Uploaded</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0 0 16px; color: #334155;"><strong>${senderName}</strong> uploaded a document to <strong>${task.title}</strong>:</p>
              <div style="background: white; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 4px; margin: 0 0 16px;">
                <p style="margin: 0; color: #334155;">📎 <strong>${documentName || 'Document'}</strong></p>
              </div>
              <div style="text-align: center;">
                <a href="${appUrl}/tasks" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Task</a>
              </div>
            </div>
            <div style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">Jarrell ISD Foundation Board Portal</p>
            </div>
          </div>
        `
      }

      const result = await sendEmail({
        to: recipient.email,
        subject,
        html: bodyHtml,
        text: type === 'comment'
          ? `${senderName} commented on "${task.title}": ${commentBody || ''}\n\nView task: ${appUrl}/tasks`
          : `${senderName} uploaded "${documentName || 'a document'}" to "${task.title}"\n\nView task: ${appUrl}/tasks`,
      })

      if (result.success) {
        notifiedCount++
        console.log(`[task-notify] Emailed ${recipient.email} — id: ${result.id}`)
      } else {
        console.error(`[task-notify] Failed to email ${recipient.email}: ${result.error}`)
      }
    }

    return NextResponse.json({ success: true, notifiedCount })
  } catch (error: any) {
    console.error('[task-notify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
