// Deep-Sight Playback WebSocket Client
// Manages connection, reconnection with exponential backoff + jitter,
// base64 decoding, and dispatching to the playback store.

import { usePlaybackStore, type PingBatchData } from '../stores/playbackStore';
import type { WsClientMessage, WsPingBatch, WsServerMessage } from '../types/api';

const WS_BASE = 'ws://localhost:8000';

/** Decode base64 string to Uint8Array with fallback. */
function decodeBase64(b64: string): Uint8Array {
  // Modern standard (2025+)
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    return (Uint8Array as any).fromBase64(b64);
  }
  // Fallback via atob
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

export class PlaybackSocket {
  private ws: WebSocket | null = null;
  private surveyId = '';
  private reconnectAttempt = 0;
  private lastPingReceived = 0;
  private speed = 4;
  private batchSize = 32;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(surveyId: string, startPing: number, speed: number, batchSize: number): void {
    this.surveyId = surveyId;
    this.speed = speed;
    this.batchSize = batchSize;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.openSocket(startPing);
  }

  send(msg: WsClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // --- Private ---

  private openSocket(startPing: number): void {
    const url = `${WS_BASE}/ws/surveys/${this.surveyId}/playback`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      // Send the required first message
      this.send({
        type: 'start',
        start_ping: startPing,
        speed: this.speed,
        batch_size: this.batchSize,
      });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsServerMessage;
        this.handleMessage(msg);
      } catch {
        // Ignore unparseable messages
      }
    };

    this.ws.onclose = () => {
      this.handleClose();
    };

    this.ws.onerror = () => {
      // onclose will fire after this  handle reconnect there
    };
  }

  private handleMessage(msg: WsServerMessage): void {
    const store = usePlaybackStore.getState();

    switch (msg.type) {
      case 'ping_batch': {
        const batch = msg as WsPingBatch;
        const decoded = decodeBase64(batch.rows);
        const batchData: PingBatchData = {
          data: decoded,
          count: batch.count,
          width: batch.width,
          startPing: batch.start_ping,
          nav: batch.nav,
        };
        this.lastPingReceived = batch.start_ping + batch.count;
        store.addBatch(batchData);
        break;
      }

      case 'detection': {
        store.addDetection(msg.detection);
        break;
      }

      case 'status': {
        store.updateProgress(msg.ping, msg.progress);
        break;
      }

      case 'done': {
        store.setComplete(msg.total_pings, msg.total_detections);
        this.shouldReconnect = false;
        break;
      }

      case 'error': {
        store.setError(msg.message);
        this.shouldReconnect = false;
        break;
      }

      default:
        // Unknown type  silently ignore for forward compatibility
        break;
    }
  }

  private handleClose(): void {
    if (!this.shouldReconnect) return;

    if (this.reconnectAttempt >= 5) {
      // Give up  tile fallback should kick in
      usePlaybackStore.getState().setError('Connection lost  using cached data');
      return;
    }

    // Exponential backoff + jitter
    const baseDelay = Math.min(500 * Math.pow(2, this.reconnectAttempt), 10000);
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;

    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      // Reconnect from last received ping, preserving detections
      this.openSocket(this.lastPingReceived);
    }, delay);
  }
}
