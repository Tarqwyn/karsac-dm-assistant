import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { getCreativeGenerationSettings, getCreativeModel, getSummaryGenerationSettings, getSummaryModel, type GenerationSettings } from '../modelSettings.js'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

function wslWindowsHost(): string | null {
  try {
    if (!existsSync('/proc/version')) return null
    const ver = readFileSync('/proc/version', 'utf-8')
    if (!ver.toLowerCase().includes('microsoft')) return null
    const out = execSync('ip route show default 2>/dev/null', { encoding: 'utf-8' })
    const match = out.match(/default via ([\d.]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function callOllamaModel(
  messages: Array<{ role: string; content: string }>,
  model: string,
  settings: GenerationSettings,
): Promise<string> {
  const primaryUrl = `${OLLAMA_HOST}/api/chat`
  const body = JSON.stringify({
    model,
    stream: true,
    messages,
    options: {
      temperature: settings.temperature,
      top_p: settings.topP,
    },
  })
  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }

  let response: Response | undefined

  try {
    response = await fetch(primaryUrl, reqInit)
  } catch {
    const winIp = wslWindowsHost()
    if (winIp && OLLAMA_HOST.includes('localhost')) {
      response = await fetch(primaryUrl.replace('localhost', winIp), reqInit).catch(() => undefined)
    }
  }

  if (!response) {
    throw new Error(`Cannot reach Ollama at ${OLLAMA_HOST}.`)
  }

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let chunk = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunk += decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    chunk = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as { message?: { content?: string } }
        if (parsed.message?.content) fullText += parsed.message.content
      } catch {
        // ignore malformed ndjson chunks
      }
    }
  }

  return fullText.trim()
}

export async function callCreativeTreatmentModel(
  messages: Array<{ role: string; content: string }>,
  model = getCreativeModel(),
  settings = getCreativeGenerationSettings(),
): Promise<{ text: string; model: string }> {
  const text = await callOllamaModel(messages, model, settings)
  return { text, model }
}

export async function callSummaryPolishModel(
  messages: Array<{ role: string; content: string }>,
  model = getSummaryModel(),
): Promise<{ text: string; model: string }> {
  const text = await callOllamaModel(messages, model, getSummaryGenerationSettings())
  return { text, model }
}
