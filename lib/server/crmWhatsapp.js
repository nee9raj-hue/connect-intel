import { emailPromptBlock } from './crmEmailPrompt.js'

export async function generateWhatsAppMessage(lead, options = {}) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'
  const shortAgenda = String(options.agenda || '').trim()

  const template = buildTemplateWhatsApp(lead, options)

  try {
    const { isPerplexityConfigured, generatePerplexityWhatsApp } = await import('./perplexity.js')
    if (isPerplexityConfigured()) {
      const msg = await generatePerplexityWhatsApp(lead, options)
      if (msg) return msg
    }
  } catch {
    // fall through
  }

  try {
    const { isGeminiConfigured, generateGeminiWhatsApp } = await import('./gemini.js')
    if (isGeminiConfigured()) {
      return await generateGeminiWhatsApp(lead, options)
    }
  } catch {
    // fall through
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey && shortAgenda.length >= 8) {
    try {
      const prompt = `${emailPromptBlock(lead, options)}

Write a WhatsApp message instead of email.
Max 80 words, casual-professional, no subject line.
Return ONLY JSON: {"message":"..."}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await response.json()
      if (response.ok) {
        const text = (data.content || [])
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (parsed.message) {
            return {
              message: String(parsed.message).trim(),
              aiGenerated: true,
              provider: 'claude',
            }
          }
        }
      }
    } catch {
      // template
    }
  }

  return { ...template, aiGenerated: false }
}

function buildTemplateWhatsApp(lead, options = {}) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'
  const sender = options.senderName || 'Your name'
  const company = options.senderCompany || 'Your company'
  const agenda = options.agenda || 'following up on a potential partnership'

  const message = `Hi ${name}, this is ${sender} from ${company}. ${agenda}

Would you have a few minutes to chat this week?`

  return { message: message.trim(), aiGenerated: false }
}
