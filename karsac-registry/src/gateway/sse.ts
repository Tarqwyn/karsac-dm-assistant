import type { ServerResponse } from 'http'

export function beginSse(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
}

export function writeSseData(res: ServerResponse, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export function endSse(res: ServerResponse): void {
  res.write('data: [DONE]\n\n')
  res.end()
}
