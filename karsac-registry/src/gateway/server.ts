import { createServer } from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from './auth.js'
import { buildModelsResponse, createChatCompletion, streamChatCompletion } from './chatCompletion.js'
import type { OpenAIChatCompletionRequest } from './openaiTypes.js'
import { getGatewayBuildInfo } from '../buildInfo.js'

const HOST = process.env.KARSAC_GATEWAY_HOST ?? '0.0.0.0'
const PORT = Number.parseInt(process.env.KARSAC_GATEWAY_PORT ?? '3210', 10)
const MODEL_ID = process.env.KARSAC_MODEL_ID ?? 'karsac-dm-assistant'
const MODEL_NAME = process.env.KARSAC_MODEL_NAME ?? 'Karsac DM Assistant'
const MODELS_CREATED = 1760000000

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  setCorsHeaders(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendError(res: ServerResponse, statusCode: number, message: string, type = 'invalid_request_error'): void {
  sendJson(res, statusCode, {
    error: {
      message,
      type,
    },
  })
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    chunks.push(buffer)
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function isChatCompletionRequest(value: unknown): value is OpenAIChatCompletionRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OpenAIChatCompletionRequest>
  return typeof candidate.model === 'string' && Array.isArray(candidate.messages)
}

async function handleModels(res: ServerResponse): Promise<void> {
  sendJson(res, 200, buildModelsResponse(MODEL_ID, MODEL_NAME, MODELS_CREATED))
}

async function handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req)
  if (!isChatCompletionRequest(body)) {
    sendError(res, 400, 'Invalid chat completion payload.')
    return
  }

  if (body.model !== MODEL_ID) {
    sendError(res, 404, `Unknown model "${body.model}". Expected "${MODEL_ID}".`, 'not_found_error')
    return
  }

  try {
    if (body.stream) {
      setCorsHeaders(res)
      await streamChatCompletion(res, body, MODEL_ID)
      return
    }

    const completion = await createChatCompletion(body, MODEL_ID)
    sendJson(res, 200, completion)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Karsac gateway request failed.'
    if (!res.headersSent) {
      sendError(res, 500, message, 'server_error')
    }
  }
}

const server = createServer(async (req, res) => {
  try {
    setCorsHeaders(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (!req.url) {
      sendError(res, 404, 'Not found.', 'not_found_error')
      return
    }

    if (!isAuthorized(req)) {
      sendError(res, 401, 'Missing or invalid API key.', 'authentication_error')
      return
    }

    if (req.method === 'GET' && req.url === '/v1/models') {
      await handleModels(res)
      return
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      await handleChatCompletions(req, res)
      return
    }

    sendError(res, 404, 'Not found.', 'not_found_error')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected gateway error.'
    if (!res.headersSent) {
      sendError(res, 500, message, 'server_error')
    }
  }
})

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST}:${PORT}/v1`
  const buildInfo = getGatewayBuildInfo()
  process.stdout.write(`[karsac-gateway] ${MODEL_NAME} listening on ${baseUrl}\n`)
  process.stdout.write(`[karsac-gateway] build ${buildInfo.buildId}\n`)
})
