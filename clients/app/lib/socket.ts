import { CONCORD_CONFIG } from './config'
import { getSession } from './auth'

type EventHandler = (event: string, payload: any) => void

export class ConcordSocket {
	private ws: WebSocket | null = null
	private refCounter = 1
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null
	private handlers = new Map<string, Set<EventHandler>>()

	connect(): void {
		const session = getSession()
		const base = CONCORD_CONFIG.gatewayUrl.replace(/^http/, 'ws')
		const params = new URLSearchParams({ vsn: '2.0.0' })
		if (session?.access_token) {
			params.set('token', session.access_token)
		}

		this.ws = new WebSocket(`${base}/socket/websocket?${params.toString()}`)

		this.ws.onopen = () => {
			this.heartbeatTimer = setInterval(() => {
				this.push('phoenix', 'heartbeat', {})
			}, 30_000)
		}

		this.ws.onmessage = (msg) => {
			try {
				const [, , topic, event, payload] = JSON.parse(msg.data)
				const listeners = this.handlers.get(topic)
				if (listeners) {
					for (const fn of listeners) fn(event, payload)
				}
			} catch {
				// ignore malformed frames
			}
		}

		this.ws.onclose = () => {
			if (this.heartbeatTimer) {
				clearInterval(this.heartbeatTimer)
				this.heartbeatTimer = null
			}
		}
	}

	join(topic: string, onEvent: EventHandler): () => void {
		if (!this.handlers.has(topic)) {
			this.handlers.set(topic, new Set())
			this.push(topic, 'phx_join', {})
		}
		this.handlers.get(topic)!.add(onEvent)

		return () => {
			const set = this.handlers.get(topic)
			if (set) {
				set.delete(onEvent)
				if (set.size === 0) {
					this.handlers.delete(topic)
					this.push(topic, 'phx_leave', {})
				}
			}
		}
	}

	push(topic: string, event: string, payload: Record<string, unknown>): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			const ref = String(this.refCounter++)
			this.ws.send(JSON.stringify([null, ref, topic, event, payload]))
		}
	}

	disconnect(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
		this.ws?.close()
		this.ws = null
	}
}
