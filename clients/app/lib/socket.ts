import { CONCORD_CONFIG } from './config'
import { getSession } from './auth'

export type EventHandler = (event: string, payload: any) => void

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export type ConnectionStateListener = (state: SocketConnectionState) => void

export interface ConcordSocketOptions {
	heartbeatIntervalMs?: number
	reconnectBaseDelayMs?: number
	reconnectMaxDelayMs?: number
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000
const DEFAULT_RECONNECT_BASE_DELAY_MS = 1_000
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000

export class ConcordSocket {
	private ws: WebSocket | null = null
	private refCounter = 1
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pendingHeartbeatRef: string | null = null
	private reconnectAttempts = 0
	private shouldReconnect = false
	private state: SocketConnectionState = 'disconnected'

	private handlers = new Map<string, Set<EventHandler>>()
	private joinPayloads = new Map<string, Record<string, unknown>>()
	private joinRefs = new Map<string, string>()
	private stateListeners = new Set<ConnectionStateListener>()

	private readonly heartbeatIntervalMs: number
	private readonly reconnectBaseDelayMs: number
	private readonly reconnectMaxDelayMs: number

	constructor(options?: ConcordSocketOptions) {
		this.heartbeatIntervalMs = options?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
		this.reconnectBaseDelayMs = options?.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS
		this.reconnectMaxDelayMs = options?.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS
	}

	getState(): SocketConnectionState {
		return this.state
	}

	onStateChange(listener: ConnectionStateListener): () => void {
		this.stateListeners.add(listener)
		listener(this.state)
		return () => {
			this.stateListeners.delete(listener)
		}
	}

	connect(): void {
		this.shouldReconnect = true

		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
		) {
			return
		}

		this.clearReconnectTimer()
		this.openSocket(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')
	}

	join(topic: string, onEvent: EventHandler, joinPayload: Record<string, unknown> = {}): () => void {
		const isNewTopic = !this.handlers.has(topic)
		if (isNewTopic) {
			this.handlers.set(topic, new Set())
			this.joinPayloads.set(topic, joinPayload)
			const joinRef = String(this.refCounter++)
			this.joinRefs.set(topic, joinRef)
			this.push(topic, 'phx_join', joinPayload, joinRef)
		}
		this.handlers.get(topic)!.add(onEvent)

		return () => {
			const set = this.handlers.get(topic)
			if (set) {
				set.delete(onEvent)
				if (set.size === 0) {
					this.handlers.delete(topic)
					this.joinPayloads.delete(topic)
					const joinRef = this.joinRefs.get(topic) ?? null
					this.joinRefs.delete(topic)
					this.push(topic, 'phx_leave', {}, joinRef)
				}
			}
		}
	}

	push(
		topic: string,
		event: string,
		payload: Record<string, unknown>,
		joinRefOverride?: string | null
	): string | null {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			return null
		}
		const ref = String(this.refCounter++)
		const joinRef =
			joinRefOverride !== undefined ? joinRefOverride : (this.joinRefs.get(topic) ?? null)
		this.ws.send(JSON.stringify([joinRef, ref, topic, event, payload]))
		return ref
	}

	disconnect(): void {
		this.shouldReconnect = false
		this.reconnectAttempts = 0
		this.clearReconnectTimer()
		this.stopHeartbeat()

		if (this.ws) {
			const socket = this.ws
			this.ws = null
			socket.onopen = null
			socket.onmessage = null
			socket.onerror = null
			socket.onclose = null
			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
				socket.close(1000, 'client_disconnect')
			}
		}

		this.setState('disconnected')
	}

	private openSocket(initialState: 'connecting' | 'reconnecting'): void {
		this.setState(initialState)

		const session = getSession()
		if (!session?.access_token) {
			this.shouldReconnect = false
			this.setState('disconnected')
			return
		}
		const base = CONCORD_CONFIG.gatewayUrl.replace(/^http/, 'ws').replace(/\/+$/, '')
		const params = new URLSearchParams({ vsn: '2.0.0', token: session.access_token })

		const socket = new WebSocket(`${base}/socket/websocket?${params.toString()}`)
		this.ws = socket

		socket.onopen = () => {
			if (this.ws !== socket) return
			this.reconnectAttempts = 0
			this.pendingHeartbeatRef = null
			this.setState('connected')
			this.startHeartbeat()
			this.rejoinActiveTopics()
		}

		socket.onmessage = (msg) => {
			if (this.ws !== socket) return
			try {
				const [, ref, topic, event, payload] = JSON.parse(msg.data)
				if (topic === 'phoenix' && event === 'phx_reply' && ref === this.pendingHeartbeatRef) {
					this.pendingHeartbeatRef = null
					return
				}

				if (event === 'phx_error' && this.handlers.has(topic)) {
					const payload = this.joinPayloads.get(topic) ?? {}
					const joinRef = String(this.refCounter++)
					this.joinRefs.set(topic, joinRef)
					this.push(topic, 'phx_join', payload, joinRef)
					return
				}

				const listeners = this.handlers.get(topic)
				if (listeners) {
					for (const fn of listeners) {
						fn(event, payload)
					}
				}
			} catch {
				// ignore malformed frames
			}
		}

		socket.onerror = () => {
			// Close event will follow and handle reconnect scheduling
		}

		socket.onclose = () => {
			if (this.ws !== socket) return
			this.ws = null
			this.stopHeartbeat()

			if (this.shouldReconnect) {
				this.scheduleReconnect()
			} else {
				this.setState('disconnected')
			}
		}
	}

	private rejoinActiveTopics(): void {
		for (const topic of this.handlers.keys()) {
			const payload = this.joinPayloads.get(topic) ?? {}
			const joinRef = String(this.refCounter++)
			this.joinRefs.set(topic, joinRef)
			this.push(topic, 'phx_join', payload, joinRef)
		}
	}

	private startHeartbeat(): void {
		this.stopHeartbeat()
		this.heartbeatTimer = setInterval(() => {
			if (this.ws?.readyState !== WebSocket.OPEN) {
				return
			}
			// If previous heartbeat never received a reply, treat connection as stale
			if (this.pendingHeartbeatRef !== null) {
				this.pendingHeartbeatRef = null
				this.ws.close(4000, 'heartbeat_timeout')
				return
			}
			this.pendingHeartbeatRef = this.push('phoenix', 'heartbeat', {})
		}, this.heartbeatIntervalMs)
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer !== null) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
		this.pendingHeartbeatRef = null
	}

	private scheduleReconnect(): void {
		this.clearReconnectTimer()
		this.setState('reconnecting')

		const exponential = this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts)
		const capped = Math.min(exponential, this.reconnectMaxDelayMs)
		// Add +/-20% jitter to avoid synchronized reconnect bursts
		const jitter = capped * 0.2 * (Math.random() * 2 - 1)
		const delay = Math.max(250, Math.round(capped + jitter))

		this.reconnectAttempts += 1
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			if (!this.shouldReconnect) return
			this.openSocket('reconnecting')
		}, delay)
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
	}

	private setState(next: SocketConnectionState): void {
		if (this.state === next) return
		this.state = next
		for (const listener of this.stateListeners) {
			listener(next)
		}
	}
}
