import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { routeQuestion, type Profile } from '../router.js'
import { detectProposalExecutionPlan } from '../proposals/proposalRouting.js'
import type { GatewayRecentMessage } from './openaiTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_ROOT = resolve(__dirname, '..', '..')
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const PROPOSAL_REQUEST_PATTERN =
  /\b(?:propose|save as proposal|write proposal|create proposal|add to corpus as proposal|generate proposal)\b/i
const META_PROMPT_TITLE_PATTERN =
  /generate a concise,\s*3-5 word title/i
const META_PROMPT_FOLLOWUPS_PATTERN =
  /suggest 3-5 relevant follow-up questions(?:\s+or prompts)?/i
const META_PROMPT_TAGS_PATTERN =
  /generate 1-3 broad tags categorizing the main themes?/i

export interface RunKarsacInput {
  message: string
  messages?: GatewayRecentMessage[]
  forceMode?: 'ask' | 'propose'
  onProgress?: (event: KarsacProgressEvent) => void
}

export interface RunKarsacResult {
  text: string
  routeProfile?: string
  proposalPath?: string
  validationStatus?: 'pass' | 'warning' | 'fail'
}

export interface KarsacProgressEvent {
  type:
    | 'route-detected'
    | 'proposal-type-detected'
    | 'generation-started'
    | 'creative-treatment-started'
    | 'creative-treatment-completed'
    | 'proposal-written'
    | 'validation-started'
    | 'validation-completed'
    | 'summary-started'
    | 'summary-completed'
  message: string
  data?: Record<string, unknown>
}

interface CommandResult {
  stdout: string
  stderr: string
}

export function isOpenWebUIMetaPrompt(message: string): boolean {
  const trimmed = message.trim()
  const hasTaskEnvelope = /###\s*task:/i.test(trimmed) && /<chat_history>/i.test(trimmed)
  if (!hasTaskEnvelope) return false

  if (META_PROMPT_TITLE_PATTERN.test(trimmed) && /"title"/i.test(trimmed)) {
    return true
  }
  if (META_PROMPT_FOLLOWUPS_PATTERN.test(trimmed) && /"follow_ups"/i.test(trimmed)) {
    return true
  }
  if (META_PROMPT_TAGS_PATTERN.test(trimmed) && /"tags"/i.test(trimmed)) {
    return true
  }
  return false
}

function shouldUseProposalMode(message: string): boolean {
  if (isOpenWebUIMetaPrompt(message)) return false
  return PROPOSAL_REQUEST_PATTERN.test(message)
}

function extractChatHistory(message: string): string {
  const match = message.match(/<chat_history>\s*([\s\S]*?)\s*<\/chat_history>/i)
  return match?.[1]?.trim() ?? ''
}

function extractLastChatUserMessage(message: string): string {
  const chatHistory = extractChatHistory(message)
  if (!chatHistory) return ''

  const userMatches = [...chatHistory.matchAll(/^\s*USER:\s*(.+)$/gim)]
  return userMatches.length > 0 ? userMatches[userMatches.length - 1][1].trim() : ''
}

function buildMetaTitle(lastUserMessage: string): string {
  const lower = lastUserMessage.toLowerCase()
  if (/\bshadow walkers?\b/.test(lower) && /\badversary\b/.test(lower)) return '🕸️ Shadow Walker Adversary'
  if (/\bpropose\b/.test(lower) && /\bplace\b/.test(lower)) return '📍 Karsac Place Proposal'
  if (/\bencounter\b/.test(lower)) return '⚔️ Karsac Encounter Design'
  if (/\bchapter\b/.test(lower)) return '📜 Karsac Chapter Planning'
  if (/\brules?\b|\bconcentration\b|\bfrightened\b|\bgrapple\b/.test(lower)) return '📘 Karsac Rules Query'
  return '🗂️ Karsac DM Assistant'
}

function buildMetaFollowUps(lastUserMessage: string): string[] {
  const lower = lastUserMessage.toLowerCase()
  if (/\badversary\b/.test(lower)) {
    return [
      'Can you make the doctrine mechanics appear directly in the stat block?',
      'Can you tighten the variant options into concrete 5e mechanics?',
      'Can you show the final adversary as a promotion-reviewable packet?',
    ]
  }
  if (/\bplace\b/.test(lower)) {
    return [
      'Can you add cultural identity and daily life for this place?',
      'Can you show how this place connects to current campaign pressures?',
      'Can you turn this into a promotion-reviewable place proposal?',
    ]
  }
  if (/\bencounter\b/.test(lower)) {
    return [
      'Can you strengthen the pressure, choice, and consequence in this encounter?',
      'Can you tune the encounter for the current party state?',
      'Can you render the encounter as a clean DM-facing proposal packet?',
    ]
  }
  return [
    'Can you tighten this into a promotion-reviewable proposal?',
    'Can you show the deterministic validation issues next?',
    'Can you turn this into a cleaner DM-facing packet?',
  ]
}

function buildMetaTags(lastUserMessage: string): string[] {
  const lower = lastUserMessage.toLowerCase()
  const tags = new Set<string>()

  if (/\badversary\b|\benemy\b|\boperative\b/.test(lower)) tags.add('adversary-design')
  if (/\bshadow walkers?\b/.test(lower)) tags.add('shadow-walkers')
  if (/\bplace\b|\btown\b|\bcity\b|\bharbour\b|\bdock\b/.test(lower)) tags.add('setting-design')
  if (/\bencounter\b/.test(lower)) tags.add('encounter-design')
  if (/\brules?\b|\bconcentration\b|\bfrightened\b|\bgrapple\b/.test(lower)) tags.add('rules')
  if (/\bproposal\b|\bpropose\b/.test(lower)) tags.add('proposal')

  if (tags.size === 0) {
    tags.add('karsac')
    tags.add('dm-assistant')
  }

  return [...tags].slice(0, 3)
}

export function buildOpenWebUIMetaResponse(message: string): string | null {
  const trimmed = message.trim()
  const lastUserMessage = extractLastChatUserMessage(trimmed)

  if (META_PROMPT_TITLE_PATTERN.test(trimmed)) {
    return JSON.stringify({ title: buildMetaTitle(lastUserMessage) })
  }

  if (META_PROMPT_FOLLOWUPS_PATTERN.test(trimmed)) {
    return JSON.stringify({ follow_ups: buildMetaFollowUps(lastUserMessage) })
  }

  if (META_PROMPT_TAGS_PATTERN.test(trimmed)) {
    return JSON.stringify({ tags: buildMetaTags(lastUserMessage) })
  }

  return null
}

function buildConversationContext(messages: GatewayRecentMessage[] | undefined): string {
  if (!messages || messages.length === 0) return ''
  const lines = messages.map((message) => `${message.role}: ${message.content.replace(/\s+/g, ' ').trim()}`)
  return `\n\nConversation context for continuity only. The latest request above is authoritative.\n${lines.join('\n')}`
}

function buildPrompt(message: string, messages: GatewayRecentMessage[] | undefined): string {
  return `${message.trim()}${buildConversationContext(messages)}`.trim()
}

function normalizeGatewayEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  if (!env.OLLAMA_HOST && env.OLLAMA_BASE_URL) {
    env.OLLAMA_HOST = env.OLLAMA_BASE_URL
  }
  return env
}

function emitProgress(
  onProgress: RunKarsacInput['onProgress'],
  event: KarsacProgressEvent,
): void {
  onProgress?.(event)
}

function bindLineEmitter(
  onLine: (line: string) => void,
): { push: (chunk: Buffer | string) => void; flush: () => void } {
  let buffer = ''

  return {
    push(chunk) {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        onLine(line)
      }
    },
    flush() {
      if (buffer.trim().length > 0) {
        onLine(buffer)
      }
      buffer = ''
    },
  }
}

function runNpmCommand(
  args: string[],
  options: {
    onStdoutLine?: (line: string) => void
    onStderrLine?: (line: string) => void
  } = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(NPM_BIN, args, {
      cwd: REGISTRY_ROOT,
      env: normalizeGatewayEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const stdoutEmitter = bindLineEmitter((line) => options.onStdoutLine?.(line))
    const stderrEmitter = bindLineEmitter((line) => options.onStderrLine?.(line))

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
      stdoutEmitter.push(chunk)
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
      stderrEmitter.push(chunk)
    })

    child.on('error', (error) => {
      rejectPromise(error)
    })

    child.on('close', (code) => {
      stdoutEmitter.flush()
      stderrEmitter.flush()
      if (code === 0) {
        resolvePromise({ stdout: stdout.trim(), stderr: stderr.trim() })
        return
      }

      rejectPromise(new Error(`Karsac command failed (${args.join(' ')}):\n${stderr || stdout}`))
    })
  })
}

function parseProposalPath(output: string): string | undefined {
  const match = output.match(/Proposal written(?: with validation failures)?:\s*(.+)/)
  return match?.[1]?.trim()
}

function parseValidationStatus(output: string): 'pass' | 'warning' | 'fail' | undefined {
  const match = output.match(/Validation:\s*(pass|warning|fail)/i)
  return match?.[1]?.toLowerCase() as 'pass' | 'warning' | 'fail' | undefined
}

function buildAskArgs(prompt: string, profile: Profile, modeOverride: string | null): string[] {
  const args = ['--silent', 'run', 'karsac:ask', '--', prompt, '--profile', profile]
  if (modeOverride) {
    args.push('--mode', modeOverride)
  }
  return args
}

export async function runKarsacRequest(input: RunKarsacInput): Promise<RunKarsacResult> {
  const metaResponse = buildOpenWebUIMetaResponse(input.message)
  if (metaResponse) {
    return {
      text: metaResponse,
      routeProfile: 'canon',
    }
  }

  const prompt = buildPrompt(input.message, input.messages)
  const forceProposal = input.forceMode === 'propose'
  const forceAsk = input.forceMode === 'ask'
  const useProposalMode = forceProposal || (!forceAsk && shouldUseProposalMode(input.message))

  if (useProposalMode) {
    const plan = detectProposalExecutionPlan(prompt)
    emitProgress(input.onProgress, {
      type: 'proposal-type-detected',
      message: `Detected proposal type: ${plan.proposalType}.\n\n`,
      data: { proposalType: plan.proposalType },
    })
    emitProgress(input.onProgress, {
      type: 'route-detected',
      message: `Using profile: ${plan.proposalProfile}.\n\n`,
      data: { profile: plan.proposalProfile, contextProfile: plan.contextProfile },
    })
    emitProgress(input.onProgress, {
      type: 'generation-started',
      message: 'Creating proposal...\n\n',
      data: { proposalType: plan.proposalType },
    })

    const result = await runNpmCommand(
      ['--silent', 'run', 'karsac:propose', '--', prompt],
      {
        onStderrLine: (line) => {
          const trimmed = line.trim()
          if (!trimmed) return

          const proposalPath = parseProposalPath(trimmed)
          if (proposalPath) {
            emitProgress(input.onProgress, {
              type: 'proposal-written',
              message: 'Proposal file written.\n\n',
              data: { proposalPath },
            })
            return
          }

          const validationStatus = parseValidationStatus(trimmed)
          if (validationStatus) {
            emitProgress(input.onProgress, {
              type: 'validation-completed',
              message: `Validation completed: ${validationStatus}.\n\n`,
              data: { validationStatus },
            })
            return
          }

          if (/^Summarising proposal/i.test(trimmed)) {
            emitProgress(input.onProgress, {
              type: 'summary-started',
              message: 'Summarising proposal...\n\n',
            })
            return
          }

          if (/^Applying creative treatment with /i.test(trimmed)) {
            emitProgress(input.onProgress, {
              type: 'creative-treatment-started',
              message: `${trimmed}\n\n`,
            })
            return
          }

          if (/^Creative treatment completed with /i.test(trimmed)) {
            emitProgress(input.onProgress, {
              type: 'creative-treatment-completed',
              message: `${trimmed}\n\n`,
            })
            return
          }

          if (/^Validating proposal/i.test(trimmed)) {
            emitProgress(input.onProgress, {
              type: 'validation-started',
              message: 'Validating proposal...\n\n',
            })
            return
          }
        },
      },
    )

    emitProgress(input.onProgress, {
      type: 'summary-completed',
      message: 'Proposal summary ready.\n\n',
    })
    return {
      text: result.stdout,
      routeProfile: plan.proposalProfile,
      proposalPath: parseProposalPath(result.stderr),
      validationStatus: parseValidationStatus(result.stderr),
    }
  }

  const routeResult = routeQuestion(input.message)
  const result = await runNpmCommand(buildAskArgs(prompt, routeResult.profile, routeResult.modeOverride ?? null))

  return {
    text: result.stdout,
    routeProfile: routeResult.profile,
  }
}
