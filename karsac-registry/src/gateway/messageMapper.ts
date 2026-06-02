import type {
  GatewayMappedRequest,
  GatewayRecentMessage,
  OpenAIChatCompletionRequest,
  OpenAIChatMessage,
  OpenAIMessageContent,
  OpenAITextPart,
} from './openaiTypes.js'

const MAX_RECENT_MESSAGES = 8
const MAX_SUMMARY_CHARS = 1400
const MAX_MESSAGE_CHARS = 320

function flattenTextParts(parts: OpenAITextPart[]): string {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

export function flattenMessageContent(content: OpenAIMessageContent): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return flattenTextParts(content)
  return ''
}

function normalizeMessages(messages: OpenAIChatMessage[]): GatewayRecentMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      content: flattenMessageContent(message.content),
    }))
    .filter((message) => message.content.length > 0)
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1)}…`
}

export function mapChatCompletionRequest(input: OpenAIChatCompletionRequest): GatewayMappedRequest {
  const normalized = normalizeMessages(input.messages ?? [])
  const latestUserIndex = [...normalized].map((message) => message.role).lastIndexOf('user')

  if (latestUserIndex === -1) {
    throw new Error('At least one user message is required.')
  }

  const latestUser = normalized[latestUserIndex]
  const recentMessages = normalized
    .slice(Math.max(0, latestUserIndex - MAX_RECENT_MESSAGES), latestUserIndex)
    .map((message) => ({
      role: message.role,
      content: truncate(message.content, MAX_MESSAGE_CHARS),
    }))

  const conversationSummary = truncate(
    recentMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n'),
    MAX_SUMMARY_CHARS,
  )

  return {
    latestUserMessage: latestUser.content,
    conversationSummary,
    recentMessages,
    mode: 'chat',
  }
}
