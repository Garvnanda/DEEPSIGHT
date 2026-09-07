// Deep-Sight playback WebSocket client.
// Connection + reconnect (exponential backoff + jitter), base64 decode, typed dispatch
// via callbacks. The store owns state; this owns the socket.

import { wsUrl } from './api'
import type { Detection, NavPoint, WsClientMessage, WsServerMessage } from './types'

export interface PingBatch {
  data: Uint8Array
  count: number
  width: number
  startPing: number
  nav: NavPoint[]
}

export interface PlaybackHandlers {
  onBatch: (b: PingBatch) => void
  onDetection: (d: Detection) => void
  onStatus: (ping: number, progress: number) => void
  onDone: (totalPings: number, totalDetections: number) => void
  onError: (message: string) => void
}

function decodeBase64(b64: string): Uint8Array {
  const fromB64 = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64
  if (typeof fromB64 === 'function') return fromB64(b64)
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export class PlaybackSocket {
  private ws: WebSocket | null = null
  private surveyId = ''
  private handlers: PlaybackHandlers
  private reconnectAttempt = 0
  private lastPing = 0
  private speed = 4
  private batchSize = 32
  private alive = true
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(handlers: PlaybackHandlers) {
    this.handlers = handlers
  }

  connect(surveyId: string, startPing: number, speed: number, batchSize: number): void {
    this.surveyId = surveyId
    this.speed = speed
    this.batchSize = batchSize
    this.alive = true
    this.reconnectAttempt = 0
    this.lastPing = startPing
    this.open(startPing)
  }

  send(msg: WsClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  disconnect(): void {
    this.alive = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
  }

  private open(startPing: number): void {
    this.ws = new WebSocket(wsUrl(`/ws/surveys/${this.surveyId}/playback`))
    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.send({ type: 'start', start_ping: startPing, speed: this.speed, batch_size: this.batchSize })
    }
    this.ws.onmessage = (ev) => {
      let msg: WsServerMessage
      try {
        msg = JSON.parse(ev.data as string) as WsServerMessage
      } catch {
        return
      }
      this.dispatch(msg)
    }
    this.ws.onclose = () => this.onClose()
    this.ws.onerror = () => {
      /* onclose handles reconnect */
    }
  }

  private dispatch(msg: WsServerMessage): void {
    switch (msg.type) {
      case 'ping_batch': {
        const data = decodeBase64(msg.rows)
        this.lastPing = msg.start_ping + msg.count
        this.handlers.onBatch({ data, count: msg.count, width: msg.width, startPing: msg.start_ping, nav: msg.nav })
        break
      }
      case 'detection':
        this.handlers.onDetection(msg.detection)
        break
      case 'status':
        this.handlers.onStatus(msg.ping, msg.progress)
        break
      case 'done':
        this.alive = false
        this.handlers.onDone(msg.total_pings, msg.total_detections)
        break
      case 'error':
        this.alive = false
        this.handlers.onError(msg.message)
        break
    }
  }

  private onClose(): void {
    if (!this.alive) return
    if (this.reconnectAttempt >= 5) {
      this.handlers.onError('Connection lost  falling back to cached tiles.')
      return
    }
    const delay = Math.min(500 * 2 ** this.reconnectAttempt, 10000) + Math.random() * 500
    this.reconnectAttempt++
    this.timer = setTimeout(() => this.open(this.lastPing), delay)
  }
}
