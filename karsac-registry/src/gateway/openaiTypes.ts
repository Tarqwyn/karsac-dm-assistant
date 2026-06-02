export type OpenAIRole = 'system' | 'user' | 'assistant' | 'tool'

export interface OpenAITextPart {
  type: 'text'
  text: string
}

export type OpenAIMessageContent = string | OpenAITextPart[] | null

export interface OpenAIChatMessage {
  role: OpenAIRole
  content: OpenAIMessageContent
  name?: string
}

export interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIChatMessage[]
  stream?: boolean
  temperature?: number | null
}

export interface OpenAIModelCard {
  id: string
  object: 'model'
  created: number
  owned_by: string
  permission: unknown[]
  root: string
  parent: string | null
  name?: string
  metadata?: Record<string, string>
}

export interface OpenAIModelsResponse {
  object: 'list'
  data: OpenAIModelCard[]
}

export interface OpenAIChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  system_fingerprint?: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: 'stop'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  system_fingerprint?: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
    }
    finish_reason: 'stop' | null
  }>
}

export interface GatewayRecentMessage {
  role: OpenAIRole
  content: string
}

export interface GatewayMappedRequest {
  latestUserMessage: string
  conversationSummary: string
  recentMessages: GatewayRecentMessage[]
  mode: 'chat'
}
