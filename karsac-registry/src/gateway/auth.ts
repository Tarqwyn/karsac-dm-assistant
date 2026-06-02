import type { IncomingMessage } from 'http'

export function getGatewayApiKey(): string {
  return process.env.KARSAC_GATEWAY_API_KEY ?? 'local-karsac-dev-key'
}

export function readBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function isAuthorized(req: IncomingMessage): boolean {
  const token = readBearerToken(req)
  return token !== null && token === getGatewayApiKey()
}
