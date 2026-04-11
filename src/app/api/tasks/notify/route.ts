import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * POST /api/tasks/notify
 * Send email notifications to task assignees
 * Body: { taskId, type: 'comment' | 'document', commentBody?: string, documentName?: string, documentUrl?: string }
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

    // Fetch the task
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', taskId)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Fetch the sender's profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.full_name || senderProfile?.email || 'A team member'

    // Fetch all task assignees (excluding the sender)
    const { data: assignees } = await supabase
      .from('task_assignees')
      .select('profile_id, profiles:profile_id(email, full_name)')
      .eq('task_id', taskId)

    if (!assignees || assignees.length === 0) {
      return NextResponse.json({ success: true, notifiedCount: 0 })
    }

    // Also include the task creator
    const { data: taskFull } = await supabase
      .from('tasks')
      .select('created_by')
      .eq('id', taskId)
      .single()

    const recipientIds = new Set(assignees.map(a => a.profile_id))
    if (taskFull?.created_by) recipientIds.add(taskFull.created_by)
    // Don't email the person who triggered the notification
    recipientIds.delete(user.id)

    if (recipientIds.size === 0) {
      return NextResponse.json({ success: true, notifiedCount: 0 })
    }

    // Fetch all recipient profiles
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(recipientIds))

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: true, notifiedCount: 0 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let notifiedCount = 0

    for (const recipient of recipients) {
      if (!recipient.email) continue

      try {
        let subject = ''
        let bodyHtml = ''

        if (type === 'comment') {
          subject = `New comment on task: ${task.title}`
          bodyHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">New Comment on Task</h2>
              <p><strong>${senderName}</strong> commented on <strong>${task.title}</strong>:</p>
              <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
                <p style="margin: 0; color: #334155;">${(commentBody || '').replace(/\n/g, '<br/>')}</p>
              </div>
              <p><a href="${appUrl}/tasks" style="color: #3b82f6;">View task in portal</a></p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">Jarrell ISD Foundation Board Portal</p>
            </div>
          `
        } else if (type === 'document') {
          subject = `New document uploaded to task: ${task.title}`
          bodyHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">New Document Uploaded</h2>
              <p><strong>${senderName}</strong> uploaded a document to <strong>${task.title}</strong>:</p>
              <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
                <p style="margin: 0; color: #334155;">📎 <strong>${documentName || 'Document'}</strong></p>
              </div>
              ${documentUrl ? `<p><a href="${documentUrl}" style="color: #3b82f6;">Download document</a></p>` : ''}
              <p><a href="${appUrl}/tasks" style="color: #3b82f6;">View task in portal</a></p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">Jarrell ISD Foundation Board Portal</p>
            </div>
          `
        }

        // Generate magic link for the recipient
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: recipient.email,
          options: {
            redirectTo: `${appUrl}/tasks`,
          },
        })

        if (linkData?.properties?.action_link) {
          // Send invitation email with the magic link
          await adminClient.auth.admin.inviteUserByEmail(recipient.email, {
            data: {
              subject,
              body_html: bodyHtml,
            },
            redirectTo: `${appUrl}/tasks`,
          })
          notifiedCount++
        }
      } catch (emailError) {
        console.error(`Failed to notify ${recipient.email}:`, emailError)
      }
    }

    return NextResponse.json({ success: true, notifiedCount })
  } catch (error: any) {
    console.error('Task notification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
