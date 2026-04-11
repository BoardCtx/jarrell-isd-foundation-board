/**
 * Email utility using Resend API.
 *
 * Env vars required:
 *   RESEND_API_KEY   – your Resend API key
 *   EMAIL_FROM       – verified sender address, e.g. "Jarrell ISD Foundation <notifications@yourdomin.com>"
 *                      (or use "onboarding@resend.dev" for testing on Resend's free tier)
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  /** Optional plain-text fallback */
  text?: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const from = process.env.EMAIL_FROM || 'Jarrell ISD Foundation <onboarding@resend.dev>'

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[email] Resend API error ${res.status}:`, body)
      return { success: false, error: `Resend ${res.status}: ${body}` }
    }

    const data = await res.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[email] Fetch error:', err.message)
    return { success: false, error: err.message }
  }
}
