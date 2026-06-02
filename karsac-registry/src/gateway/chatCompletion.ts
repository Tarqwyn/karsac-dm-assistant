import type { ServerResponse } from 'http'
import { beginSse, endSse, writeSseData } from './sse.js'
import type {
  OpenAIChatCompletionChunk,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIModelsResponse,
} from './openaiTypes.js'
import { mapChatCompletionRequest } from './messageMapper.js'
import { runKarsacRequest } from './karsacRunner.js'
import { getGatewayBuildInfo } from '../buildInfo.js'

function buildUsage(): OpenAIChatCompletionResponse['usage'] {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  }
}

function chunkText(content: string): string[] {
  const chunks = content.match(/\S+\s*/g)
  return chunks && chunks.length > 0 ? chunks : [content]
}

function writeAssistantChunk(
  res: ServerResponse,
  completionId: string,
  created: number,
  modelId: string,
  systemFingerprint: string,
  content: string,
): void {
  const contentChunk: OpenAIChatCompletionChunk = {
    id: completionId,
    object: 'chat.completion.chunk',
    created,
    model: modelId,
    system_fingerprint: systemFingerprint,
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  }
  writeSseData(res, contentChunk)
}

export function buildModelsResponse(modelId: string, modelName: string, created: number): OpenAIModelsResponse {
  const buildInfo = getGatewayBuildInfo()
  return {
    object: 'list',
    data: [
      {
        id: modelId,
        object: 'model',
        created,
        owned_by: 'local',
        permission: [],
        root: modelId,
        parent: null,
        name: modelName,
        metadata: {
          gateway_build: buildInfo.buildId,
          registry_version: buildInfo.version,
          registry_build_timestamp: buildInfo.buildTimestamp,
        },
      },
    ],
  }
}

export async function createChatCompletion(
  requestBody: OpenAIChatCompletionRequest,
  modelId: string,
): Promise<OpenAIChatCompletionResponse> {
  const buildInfo = getGatewayBuildInfo()
  const mapped = mapChatCompletionRequest(requestBody)
  const result = await runKarsacRequest({
    message: mapped.latestUserMessage,
    messages: mapped.recentMessages,
  })

  return {
    id: `chatcmpl-karsac-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    system_fingerprint: buildInfo.buildId,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.text,
        },
        finish_reason: 'stop',
      },
    ],
    usage: buildUsage(),
  }
}

export async function streamChatCompletion(
  res: ServerResponse,
  requestBody: OpenAIChatCompletionRequest,
  modelId: string,
): Promise<void> {
  const mapped = mapChatCompletionRequest(requestBody)
  const completionId = `chatcmpl-karsac-${Date.now()}`
  const created = Math.floor(Date.now() / 1000)
  const buildInfo = getGatewayBuildInfo()

  beginSse(res)

  const firstChunk: OpenAIChatCompletionChunk = {
    id: completionId,
    object: 'chat.completion.chunk',
    created,
    model: modelId,
    system_fingerprint: buildInfo.buildId,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
  }
  writeSseData(res, firstChunk)

  const result = await runKarsacRequest({
    message: mapped.latestUserMessage,
    messages: mapped.recentMessages,
    onProgress: (event) => {
      writeAssistantChunk(res, completionId, created, modelId, buildInfo.buildId, event.message)
    },
  })

  const chunks = chunkText(result.text)
  for (const chunk of chunks) {
    writeAssistantChunk(res, completionId, created, modelId, buildInfo.buildId, chunk)
  }

  const finalChunk: OpenAIChatCompletionChunk = {
    id: completionId,
    object: 'chat.completion.chunk',
    created,
    model: modelId,
    system_fingerprint: buildInfo.buildId,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  }
  writeSseData(res, finalChunk)
  endSse(res)
}
