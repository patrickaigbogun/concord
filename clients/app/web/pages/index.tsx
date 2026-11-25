import { useEffect, useRef, useState } from 'react'
import {
	ApiError,
	addReaction,
	createRealm,
	createSpace,
	fetchFiles,
	fetchMedia,
	fetchMessages,
	fetchRealms,
	fetchSpaces,
	joinSpace,
	removeReaction,
	sendMessage,
	updateSpaceIdentity,
	type ApiFileAsset,
	type ApiMessage,
	type ApiRealm,
	type ApiSpace,
} from '../../lib/api'
import {
	clearSession,
	getSession,
	listenForTauriDeepLink,
	startSignIn,
	type ConcordSession,
} from '../../lib/auth'
import { INITIAL_FILES, INITIAL_MESSAGES, INITIAL_REALMS } from '../../lib/demo'
import { hapticMenu, hapticReply, hapticTap } from '../../lib/haptics'
import { ConcordSocket, type SocketConnectionState } from '../../lib/socket'
import { isUuid, safeMediaUrl } from '../../lib/url'
import type { ChatMessage, FileAsset, Realm, RealmNote, RoomViewMode, Space } from '../../lib/types'
import { AttachmentTray, type DeviceGalleryItem } from '../components/AttachmentTray'
import {
	CreateRealmModal,
	CreateSpaceModal,
	SpacePersonaModal,
} from '../components/CreateModals'
import { LeftRealmsPanel } from '../components/LeftRealmsPanel'
import { RealmNoteBar } from '../components/RealmNoteBar'
import { RealmNoteModal } from '../components/RealmNoteModal'
import { RealmOverviewModal } from '../components/RealmOverviewModal'
import { RightSpacePanel } from '../components/RightSpacePanel'
import { SpaceOrbBar } from '../components/SpaceOrbBar'
import { StickerGifTray } from '../components/StickerGifTray'

export const metadata = { title: 'Concord' }

const VIEW_MODE_KEY = 'concord_rooms_view_mode'
const QUICK_REACTIONS = ['✦', '🔥', '❤️', '👏']

const ORB_GRADIENTS = [
	'from-violet-500 to-indigo-600',
	'from-fuchsia-500 to-rose-500',
	'from-cyan-500 to-blue-600',
	'from-emerald-500 to-teal-600',
	'from-amber-500 to-orange-600',
	'from-pink-500 to-purple-600',
	'from-sky-500 to-indigo-500',
]

const DEFAULT_COVER =
	'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'

function formatTime(iso?: string): string {
	if (!iso) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function classifyAssetKind(contentType: string, filename: string): FileAsset['kind'] {
	const ct = contentType.toLowerCase()
	const name = filename.toLowerCase()
	if (ct.startsWith('image/')) return 'image'
	if (ct.startsWith('video/')) return 'video'
	if (ct.startsWith('audio/')) return 'audio'
	if (name.startsWith('http://') || name.startsWith('https://')) return 'link'
	return 'doc'
}

function mapApiSpace(sp: ApiSpace, index: number): Space {
	const validKinds = ['direct', 'group', 'community', 'organization'] as const
	const kind = validKinds.includes(sp.kind as (typeof validKinds)[number])
		? (sp.kind as Space['kind'])
		: 'community'
	return {
		id: sp.id,
		realmId: sp.realm_id,
		name: sp.name,
		slug: sp.slug,
		description: sp.description || undefined,
		orbImage: sp.icon_url || undefined,
		orbGradient: ORB_GRADIENTS[index % ORB_GRADIENTS.length],
		kind,
	}
}

function mapApiRealm(r: ApiRealm, spaces: Space[]): Realm {
	return {
		id: r.id,
		name: r.name,
		slug: r.slug,
		description: r.description || undefined,
		coverUrl: r.banner_url || r.icon_url || DEFAULT_COVER,
		accentColor: '#8b5cf6',
		spaces:
			spaces.length > 0
				? spaces
				: [
						{
							id: `${r.id}-general`,
							realmId: r.id,
							name: 'General',
							slug: 'general',
							orbGradient: ORB_GRADIENTS[0],
							kind: 'community',
						},
					],
	}
}

function mapApiMessage(
	m: ApiMessage,
	currentUserId?: string,
	byId?: Map<string, ApiMessage>
): ChatMessage {
	const groupedReactions = new Map<string, { emoji: string; count: number; reacted?: boolean }>()
	if (Array.isArray(m.reactions)) {
		for (const rx of m.reactions) {
			const existing = groupedReactions.get(rx.emoji)
			const count = rx.count ?? (existing ? existing.count + 1 : 1)
			const reacted = existing?.reacted || (currentUserId ? rx.user_id === currentUserId : false)
			groupedReactions.set(rx.emoji, { emoji: rx.emoji, count, reacted })
		}
	}
	const authorName =
		m.author?.display_name || m.author?.username || m.author_name || m.author_handle || 'Member'
	const authorHandle = m.author?.username || m.author_handle || 'member'
	const authorAvatar = safeMediaUrl(m.author?.avatar_url || m.author_avatar) || undefined

	const parent = m.reply_to_id && byId ? byId.get(m.reply_to_id) : undefined
	const replyTo = parent
		? {
				id: parent.id,
				authorName:
					parent.author?.display_name ||
					parent.author?.username ||
					parent.author_name ||
					parent.author_handle ||
					'Member',
				excerpt: parent.content.slice(0, 64),
			}
		: undefined

	return {
		id: m.id,
		spaceId: m.space_id,
		authorId: m.author_id,
		authorName,
		authorHandle,
		authorAvatar,
		isSelf: Boolean(currentUserId && m.author_id === currentUserId),
		content: m.content,
		replyTo,
		reactions: groupedReactions.size > 0 ? Array.from(groupedReactions.values()) : undefined,
		createdAt: formatTime(m.inserted_at ?? m.created_at),
	}
}

function mapApiFile(f: ApiFileAsset): FileAsset {
	const kind = classifyAssetKind(f.content_type, f.url || f.filename)
	return {
		id: f.id,
		spaceId: f.space_id,
		filename: f.filename,
		contentType: f.content_type,
		sizeBytes: f.size_bytes,
		url: safeMediaUrl(f.url) || '',
		kind,
		createdAt: formatTime(f.inserted_at ?? f.created_at),
	}
}

function isLiveId(id: string): boolean {
	return isUuid(id)
}

function newTempId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `tmp-${crypto.randomUUID()}`
	}
	return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function shouldIgnorePaneSwipe(target: EventTarget | null, boundary: HTMLElement | null): boolean {
	let node = target as HTMLElement | null
	while (node && node !== boundary) {
		if (node.dataset?.noPaneSwipe === 'true') return true
		const tag = node.tagName
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'AUDIO' || tag === 'VIDEO' || tag === 'SELECT') {
			return true
		}
		if (node.scrollWidth > node.clientWidth + 2) {
			const style = window.getComputedStyle(node)
			if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
				return true
			}
		}
		node = node.parentElement
	}
	return false
}

/**
 * Pronounced comic-book speech bubble tail SVG pointing toward the speaker.
 */
function SpeechBubbleTail({ side, color }: { side: 'left' | 'right'; color: string }) {
	if (side === 'left') {
		return (
			<svg
				className="absolute -left-[10px] bottom-[3px] w-[14px] h-[16px] pointer-events-none"
				viewBox="0 0 14 16"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M14 0C14 7.5 8 13.5 0.5 15C4.5 11.2 6.5 7 6.5 0H14Z"
					fill={color}
				/>
			</svg>
		)
	}
	return (
		<svg
			className="absolute -right-[10px] bottom-[3px] w-[14px] h-[16px] pointer-events-none"
			viewBox="0 0 14 16"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M0 0C0 7.5 6 13.5 13.5 15C9.5 11.2 7.5 7 7.5 0H0Z"
				fill={color}
			/>
		</svg>
	)
}

export default function ConcordAppPage() {
	const [session, setSession] = useState<ConcordSession | null>(null)
	const [viewMode, setViewMode] = useState<RoomViewMode>('grid-titled')
	const [realms, setRealms] = useState<Realm[]>(INITIAL_REALMS)
	const [activeRealmId, setActiveRealmId] = useState(INITIAL_REALMS[0].id)
	const [activeSpaceId, setActiveSpaceId] = useState(INITIAL_REALMS[0].spaces[0].id)

	const [messagesBySpace, setMessagesBySpace] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES)
	const [filesBySpace, setFilesBySpace] = useState<Record<string, FileAsset[]>>(INITIAL_FILES)
	const [personasBySpace, setPersonasBySpace] = useState<
		Record<string, { tag?: string; display_name?: string; is_anonymous: boolean }>
	>({})

	// Device gallery items persisted across tray opens in this session
	const [deviceGallery, setDeviceGallery] = useState<DeviceGalleryItem[]>([])

	const [draft, setDraft] = useState('')
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
	const [replyPulse, setReplyPulse] = useState(false)
	const [orbBarExpanded, setOrbBarExpanded] = useState(false)
	const [openTray, setOpenTray] = useState<'none' | 'media' | 'stickers'>('none')
	const [realmOverviewOpen, setRealmOverviewOpen] = useState(false)

	// Action modals
	const [createRealmOpen, setCreateRealmOpen] = useState(false)
	const [createSpaceOpen, setCreateSpaceOpen] = useState(false)
	const [personaModalOpen, setPersonaModalOpen] = useState(false)
	const [noteModalOpen, setNoteModalOpen] = useState(false)

	// Long-press / double-tap message interactions
	const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null)
	const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)
	const longPressTriggeredRef = useRef(false)
	const lastTapRef = useRef<{ msgId: string; time: number } | null>(null)
	const replyPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const composerInputRef = useRef<HTMLInputElement>(null)

	// Realtime socket state
	const socketRef = useRef<ConcordSocket | null>(null)
	const [socketState, setSocketState] = useState<SocketConnectionState>('disconnected')

	// Mobile 3-panel spatial state
	const [mobilePane, setMobilePane] = useState<'left' | 'center' | 'right'>('center')
	const touchStartRef = useRef<{ x: number; y: number } | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const activeRealm = realms.find((r) => r.id === activeRealmId) || realms[0]
	const activeSpace = activeRealm.spaces.find((s) => s.id === activeSpaceId) || activeRealm.spaces[0]
	const messages = messagesBySpace[activeSpace.id] || []
	const spaceFiles = filesBySpace[activeSpace.id] || []
	const activePersona = personasBySpace[activeSpace.id]

	useEffect(() => {
		setSession(getSession())
		const savedMode = localStorage.getItem(VIEW_MODE_KEY) as RoomViewMode | null
		if (savedMode === 'grid-titled' || savedMode === 'grid-visual' || savedMode === 'list') {
			setViewMode(savedMode)
		}

		let cancelled = false
		let unlisten: (() => void) | undefined
		listenForTauriDeepLink((s) => setSession(s)).then((fn) => {
			if (cancelled) fn()
			else unlisten = fn
		})
		return () => {
			cancelled = true
			unlisten?.()
		}
	}, [])

	// Hydrate Realms & Spaces when signed in
	useEffect(() => {
		if (!session?.access_token) return
		let cancelled = false

		;(async () => {
			try {
				const apiRealms = await fetchRealms()
				if (cancelled || !apiRealms.length) return

				const hydrated: Realm[] = await Promise.all(
					apiRealms.map(async (r) => {
						try {
							const spList = await fetchSpaces(r.id)
							return mapApiRealm(
								r,
								spList.map((sp, i) => mapApiSpace(sp, i))
							)
						} catch {
							return mapApiRealm(r, [])
						}
					})
				)

				if (!cancelled && hydrated.length > 0) {
					setRealms(hydrated)
					setActiveRealmId(hydrated[0].id)
					setActiveSpaceId(hydrated[0].spaces[0].id)
				}
			} catch {
				// Graceful fallback
			}
		})()

		return () => {
			cancelled = true
		}
	}, [session?.access_token])

	// Hydrate active Space messages and files when live
	useEffect(() => {
		if (!session?.access_token || !isLiveId(activeSpace.id)) return
		let cancelled = false

		;(async () => {
			try {
				const [apiMsgs, apiFiles, apiMedia] = await Promise.all([
					fetchMessages(activeSpace.id).catch(() => []),
					fetchFiles(activeSpace.id).catch(() => []),
					fetchMedia(activeSpace.id).catch(() => []),
				])
				if (cancelled) return

				if (apiMsgs.length > 0) {
					const byId = new Map(apiMsgs.map((m) => [m.id, m]))
					setMessagesBySpace((prev) => ({
						...prev,
						[activeSpace.id]: apiMsgs.map((m) => mapApiMessage(m, session.user.id, byId)),
					}))
				}
				const combinedFiles = [...apiFiles, ...apiMedia]
				if (combinedFiles.length > 0) {
					const dedup = new Map<string, FileAsset>()
					for (const f of combinedFiles) {
						dedup.set(f.id, mapApiFile(f))
					}
					setFilesBySpace((prev) => ({
						...prev,
						[activeSpace.id]: Array.from(dedup.values()),
					}))
				}
			} catch {
				// Graceful fallback
			}
		})()

		return () => {
			cancelled = true
		}
	}, [session?.access_token, session?.user.id, activeSpace.id])

	// ConcordSocket lifecycle
	useEffect(() => {
		if (!session?.access_token) {
			socketRef.current?.disconnect()
			socketRef.current = null
			setSocketState('disconnected')
			return
		}

		const socket = new ConcordSocket()
		socketRef.current = socket
		const unsubState = socket.onStateChange((st) => setSocketState(st))
		socket.connect()

		return () => {
			unsubState()
			socket.disconnect()
			socketRef.current = null
		}
	}, [session?.access_token])

	// Join active Space channel
	useEffect(() => {
		const socket = socketRef.current
		if (!socket || !session?.access_token || !isLiveId(activeSpace.id)) return

		const leave = socket.join(`space:${activeSpace.id}`, (event, payload) => {
			if (event === 'message_created' && payload?.id) {
				const mapped = mapApiMessage(payload as ApiMessage, session.user.id)
				setMessagesBySpace((prev) => {
					const existing = prev[activeSpace.id] || []
					if (existing.some((m) => m.id === mapped.id)) return prev
					return { ...prev, [activeSpace.id]: [...existing, mapped] }
				})
			} else if (event === 'reaction_added' && payload?.message_id && payload?.emoji) {
				if (payload.user_id && payload.user_id === session.user.id) return
				setMessagesBySpace((prev) => ({
					...prev,
					[activeSpace.id]: (prev[activeSpace.id] || []).map((m) => {
						if (m.id !== payload.message_id) return m
						const list = m.reactions ? [...m.reactions] : []
						const idx = list.findIndex((r) => r.emoji === payload.emoji)
						if (idx >= 0) {
							list[idx] = { ...list[idx], count: list[idx].count + 1 }
						} else {
							list.push({ emoji: payload.emoji, count: 1, reacted: false })
						}
						return { ...m, reactions: list }
					}),
				}))
			}
		})

		return () => {
			leave()
		}
	}, [session?.access_token, session?.user.id, activeSpace.id])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages.length, activeSpace.id])

	useEffect(() => {
		setActiveActionMsgId(null)
		setReplyTo(null)
		setOpenTray('none')
	}, [activeSpace.id])

	useEffect(() => {
		return () => {
			if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
			if (replyPulseTimerRef.current) clearTimeout(replyPulseTimerRef.current)
		}
	}, [])

	// Proper reply trigger: haptic + highlight input + synchronously raise mobile keyboard
	const triggerReply = (msg: ChatMessage) => {
		hapticReply()
		setReplyTo(msg)
		setActiveActionMsgId(null)
		setOpenTray('none')
		setOrbBarExpanded(false)
		setReplyPulse(true)
		if (replyPulseTimerRef.current) clearTimeout(replyPulseTimerRef.current)
		replyPulseTimerRef.current = setTimeout(() => setReplyPulse(false), 700)
		// Synchronously focus inside the user gesture so Android/iOS opens the soft keyboard
		composerInputRef.current?.focus()
	}

	const handleChangeViewMode = (mode: RoomViewMode) => {
		setViewMode(mode)
		localStorage.setItem(VIEW_MODE_KEY, mode)
	}

	const handleSelectRealm = (realmId: string) => {
		const target = realms.find((r) => r.id === realmId)
		if (!target) return
		setActiveRealmId(target.id)
		setActiveSpaceId(target.spaces[0].id)
		setMobilePane('center')
	}

	const sendTextContent = async (rawText: string) => {
		const text = rawText.trim()
		if (!text) return

		hapticTap()
		const tempId = newTempId()
		const currentReply = replyTo
		const targetSpaceId = activeSpace.id
		const newMsg: ChatMessage = {
			id: tempId,
			spaceId: targetSpaceId,
			authorId: session?.user.id || 'self',
			authorName: activePersona?.is_anonymous
				? 'Anonymous'
				: activePersona?.display_name || session?.user.display_name || 'You',
			authorHandle: activePersona?.tag || session?.user.username || 'galediç',
			authorAvatar: session?.user.avatar_url,
			isSelf: true,
			content: text,
			replyTo: currentReply
				? {
						id: currentReply.id,
						authorName: currentReply.authorName,
						excerpt: currentReply.content.slice(0, 64),
					}
				: undefined,
			createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		}

		setMessagesBySpace((prev) => ({
			...prev,
			[targetSpaceId]: [...(prev[targetSpaceId] || []), newMsg],
		}))
		setDraft('')
		setReplyTo(null)

		if (session?.access_token && isLiveId(targetSpaceId)) {
			try {
				const created = await sendMessage(targetSpaceId, {
					content: text,
					reply_to_id: currentReply && isLiveId(currentReply.id) ? currentReply.id : undefined,
				})
				setMessagesBySpace((prev) => {
					const list = prev[targetSpaceId] || []
					const alreadyArrivedViaWs = list.some((m) => m.id === created.id)
					const next = alreadyArrivedViaWs
						? list.filter((m) => m.id !== tempId)
						: list.map((m) => (m.id === tempId ? { ...m, id: created.id } : m))
					return { ...prev, [targetSpaceId]: next }
				})
			} catch {
				// Keep optimistic message visible
			}
		}
	}

	const handleSendMessage = async (e?: React.FormEvent) => {
		e?.preventDefault()
		await sendTextContent(draft)
	}

	const handleSendAsset = async (asset: FileAsset, caption?: string) => {
		const targetSpaceId = activeSpace.id
		setFilesBySpace((prev) => ({
			...prev,
			[targetSpaceId]: [asset, ...(prev[targetSpaceId] || [])],
		}))

		const content =
			caption ||
			(asset.kind === 'image'
				? ''
				: asset.kind === 'audio'
					? 'Voice note'
					: `Shared ${asset.filename}`)

		const tempId = newTempId()
		const newMsg: ChatMessage = {
			id: tempId,
			spaceId: targetSpaceId,
			authorId: session?.user.id || 'self',
			authorName: activePersona?.display_name || session?.user.display_name || 'You',
			authorHandle: activePersona?.tag || session?.user.username || 'galediç',
			isSelf: true,
			content,
			attachment: asset,
			createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		}

		setMessagesBySpace((prev) => ({
			...prev,
			[targetSpaceId]: [...(prev[targetSpaceId] || []), newMsg],
		}))

		if (session?.access_token && isLiveId(targetSpaceId)) {
			const backendType =
				asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'audio'
					? 'media'
					: 'file'
			try {
				const created = await sendMessage(targetSpaceId, {
					content: content || asset.url,
					type: backendType,
				})
				setMessagesBySpace((prev) => {
					const list = prev[targetSpaceId] || []
					const alreadyArrivedViaWs = list.some((m) => m.id === created.id)
					const next = alreadyArrivedViaWs
						? list.filter((m) => m.id !== tempId)
						: list.map((m) => (m.id === tempId ? { ...m, id: created.id } : m))
					return { ...prev, [targetSpaceId]: next }
				})
			} catch {
				// Optimistic local state already updated
			}
		}
	}

	const handleToggleReaction = async (msgId: string, emoji: string) => {
		hapticTap()
		const targetMsg = (messagesBySpace[activeSpace.id] || []).find((m) => m.id === msgId)
		const wasReacted = Boolean(targetMsg?.reactions?.find((r) => r.emoji === emoji)?.reacted)

		setMessagesBySpace((prev) => ({
			...prev,
			[activeSpace.id]: (prev[activeSpace.id] || []).map((m) => {
				if (m.id !== msgId) return m
				const list = m.reactions ? [...m.reactions] : []
				const idx = list.findIndex((r) => r.emoji === emoji)
				if (idx >= 0) {
					const existing = list[idx]
					if (existing.reacted) {
						if (existing.count <= 1) list.splice(idx, 1)
						else list[idx] = { ...existing, count: existing.count - 1, reacted: false }
					} else {
						list[idx] = { ...existing, count: existing.count + 1, reacted: true }
					}
				} else {
					list.push({ emoji, count: 1, reacted: true })
				}
				return { ...m, reactions: list }
			}),
		}))
		setActiveActionMsgId(null)

		if (session?.access_token && isLiveId(msgId)) {
			try {
				if (wasReacted) await removeReaction(msgId, emoji)
				else await addReaction(msgId, emoji)
			} catch {
				// Optimistic reaction kept
			}
		}
	}

	const handleCopyMessage = async (msg: ChatMessage) => {
		if (!msg.content) return
		hapticTap()
		try {
			await navigator.clipboard.writeText(msg.content)
			setCopiedMsgId(msg.id)
			setTimeout(() => setCopiedMsgId((curr) => (curr === msg.id ? null : curr)), 1500)
		} catch {
			// Clipboard unavailable
		}
		setActiveActionMsgId(null)
	}

	const handleSaveRealmNote = (note: RealmNote) => {
		setRealms((prev) => prev.map((r) => (r.id === activeRealm.id ? { ...r, note } : r)))
		setNoteModalOpen(false)
	}

	// Touch handlers for controlled long-press menu + fast mobile double-tap reply
	const onMessageTouchStart = (msgId: string, e: React.TouchEvent) => {
		const t = e.touches[0]
		longPressOriginRef.current = { x: t.clientX, y: t.clientY }
		longPressTriggeredRef.current = false
		if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
		longPressTimerRef.current = setTimeout(() => {
			longPressTriggeredRef.current = true
			hapticMenu()
			setActiveActionMsgId(msgId)
		}, 420)
	}

	const onMessageTouchMove = (e: React.TouchEvent) => {
		if (!longPressOriginRef.current || !longPressTimerRef.current) return
		const t = e.touches[0]
		if (
			Math.abs(t.clientX - longPressOriginRef.current.x) > 10 ||
			Math.abs(t.clientY - longPressOriginRef.current.y) > 10
		) {
			clearTimeout(longPressTimerRef.current)
			longPressTimerRef.current = null
		}
	}

	const onMessageTouchEnd = (msg: ChatMessage, e: React.TouchEvent) => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current)
			longPressTimerRef.current = null
		}
		const origin = longPressOriginRef.current
		longPressOriginRef.current = null
		if (longPressTriggeredRef.current || !origin) return

		const t = e.changedTouches[0]
		const moved = Math.abs(t.clientX - origin.x) > 12 || Math.abs(t.clientY - origin.y) > 12
		if (moved) return

		const now = Date.now()
		const prev = lastTapRef.current
		if (prev && prev.msgId === msg.id && now - prev.time < 320) {
			lastTapRef.current = null
			e.preventDefault()
			triggerReply(msg)
		} else {
			lastTapRef.current = { msgId: msg.id, time: now }
		}
	}

	const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (shouldIgnorePaneSwipe(e.target, e.currentTarget)) {
			touchStartRef.current = null
			return
		}
		const t = e.touches[0]
		touchStartRef.current = { x: t.clientX, y: t.clientY }
	}

	const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
		if (!touchStartRef.current) return
		const t = e.changedTouches[0]
		const dx = t.clientX - touchStartRef.current.x
		const dy = t.clientY - touchStartRef.current.y
		touchStartRef.current = null

		if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return

		if (dx > 0) {
			if (mobilePane === 'right') setMobilePane('center')
			else if (mobilePane === 'center') setMobilePane('left')
		} else {
			if (mobilePane === 'left') setMobilePane('center')
			else if (mobilePane === 'center') setMobilePane('right')
		}
	}

	return (
		<div
			id="concord-app-root"
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onContextMenu={(e) => {
				const tag = (e.target as HTMLElement)?.tagName
				if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
					e.preventDefault()
				}
			}}
			className="h-[100dvh] w-full overflow-hidden bg-[#0a0a0e] text-zinc-100 flex relative select-none"
		>
			{/* LEFT PANEL: Visual Realms Grid (Boxes with Round Images + Title) */}
			<div
				className={`fixed inset-y-0 left-0 z-30 w-[84vw] max-w-[320px] lg:static lg:w-[292px] lg:translate-x-0 transition-transform duration-300 ease-out ${
					mobilePane === 'left' ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'
				}`}
			>
				<LeftRealmsPanel
					realms={realms}
					activeRealmId={activeRealm.id}
					viewMode={viewMode}
					onChangeViewMode={handleChangeViewMode}
					onSelectRealm={handleSelectRealm}
					onCreateRealm={() => setCreateRealmOpen(true)}
					session={session}
					onSignIn={() => startSignIn()}
					onSignOut={() => {
						clearSession()
						setSession(null)
						setRealms(INITIAL_REALMS)
						setActiveRealmId(INITIAL_REALMS[0].id)
						setActiveSpaceId(INITIAL_REALMS[0].spaces[0].id)
						setMessagesBySpace(INITIAL_MESSAGES)
						setFilesBySpace(INITIAL_FILES)
						setPersonasBySpace({})
					}}
				/>
			</div>

			{/* Mobile Backdrop when Left Drawer is open */}
			{mobilePane === 'left' && (
				<button
					type="button"
					aria-label="Close realms drawer"
					onClick={() => setMobilePane('center')}
					className="fixed inset-0 z-20 bg-black/60 lg:hidden"
				/>
			)}

			{/* CENTER STAGE: Active Space Conversation */}
			<main className="flex-1 min-w-0 h-full flex flex-col bg-[#0a0a0e]">
				{/* Clean Top Bar */}
				<header className="px-4 pt-[max(0.65rem,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between gap-3 shrink-0 bg-[#0e0e13]">
					<div className="flex items-center gap-3 min-w-0">
						<button
							type="button"
							onClick={() => setMobilePane('left')}
							className="lg:hidden p-2 -ml-1 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
							aria-label="Open Realms"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
								<rect x="3" y="3" width="7" height="7" rx="1.5" />
								<rect x="14" y="3" width="7" height="7" rx="1.5" />
								<rect x="3" y="14" width="7" height="7" rx="1.5" />
								<rect x="14" y="14" width="7" height="7" rx="1.5" />
							</svg>
						</button>

						<button
							type="button"
							onClick={() => setRealmOverviewOpen(true)}
							className="flex items-center gap-3 min-w-0 text-left group cursor-pointer focus:outline-none"
							title="View Realm details & stats"
						>
							<img
								src={activeRealm.coverUrl}
								alt={activeRealm.name}
								className="w-10 h-10 rounded-full object-cover shrink-0"
							/>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="text-[17px] font-bold text-white truncate group-hover:text-[#c4b5fd] transition">
										{activeSpace.name}
									</span>
									{socketState === 'connected' && (
										<span
											title="Realtime connected"
											className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
										/>
									)}
								</div>
								<p className="text-[13px] text-zinc-400 truncate">{activeRealm.name}</p>
							</div>
						</button>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<button
							type="button"
							onClick={() => setPersonaModalOpen(true)}
							title="Contextual Space Persona"
							className="px-3 py-1.5 rounded-xl bg-[#181820] hover:bg-[#22222d] text-[13px] font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
						>
							{activePersona?.is_anonymous
								? 'Anon'
								: activePersona?.tag
									? `@${activePersona.tag}`
									: 'Persona'}
						</button>

						<button
							type="button"
							onClick={() => setMobilePane((p) => (p === 'right' ? 'center' : 'right'))}
							className="lg:hidden p-2 rounded-xl bg-[#181820] text-zinc-200 hover:text-white cursor-pointer"
							aria-label="Open Space media and files"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="18" height="18" rx="3" />
								<circle cx="8.5" cy="8.5" r="1.5" />
								<path d="M21 15l-5-5L5 21" />
							</svg>
						</button>
					</div>
				</header>

				{/* Curator's Realm Note Bar */}
				<RealmNoteBar
					note={activeRealm.note}
					onEditNote={() => setNoteModalOpen(true)}
				/>

				{/* Conversation Stream: Comic Speech Bubbles Coming From Sender Avatar, Name Underneath */}
				<div
					onClick={() => activeActionMsgId && setActiveActionMsgId(null)}
					className="flex-1 overflow-y-auto px-3.5 md:px-8 py-4"
				>
					<div className="max-w-2xl mx-auto flex flex-col">
						{messages.length === 0 ? (
							<div className="text-center py-20 space-y-2">
								<div className="text-[18px] font-editorial italic text-zinc-400">
									“{activeSpace.name}” is quiet.
								</div>
								<p className="text-[14px] text-zinc-500">Write the first line below.</p>
							</div>
						) : (
							messages.map((msg, idx) => {
								const prev = idx > 0 ? messages[idx - 1] : null
								const next = idx < messages.length - 1 ? messages[idx + 1] : null
								const sameAuthorAsPrev = Boolean(prev && prev.authorId === msg.authorId && prev.isSelf === msg.isSelf)
								const isLastInGroup = !next || next.authorId !== msg.authorId || next.isSelf !== msg.isSelf
								const actionsOpen = activeActionMsgId === msg.id
								const avatarUrl = safeMediaUrl(msg.authorAvatar)

								return (
									<div
										key={msg.id}
										onDoubleClick={() => triggerReply(msg)}
										onTouchStart={(e) => onMessageTouchStart(msg.id, e)}
										onTouchMove={onMessageTouchMove}
										onTouchEnd={(e) => onMessageTouchEnd(msg, e)}
										onTouchCancel={() => {
											if (longPressTimerRef.current) {
												clearTimeout(longPressTimerRef.current)
												longPressTimerRef.current = null
											}
										}}
										className={`group relative flex flex-col ${
											msg.isSelf ? 'items-end' : 'items-start'
										} ${idx === 0 ? '' : sameAuthorAsPrev ? 'mt-1.5' : 'mt-4'}`}
									>
										{/* Floating Overlay Action Bar */}
										<div
											onClick={(e) => e.stopPropagation()}
											className={`absolute -top-10 z-20 ${
												msg.isSelf ? 'right-0' : 'left-11'
											} flex items-center gap-1 px-2 py-1 rounded-full bg-[#1a1a24] shadow-xl shadow-black/70 transition-opacity ${
												actionsOpen
													? 'opacity-100 pointer-events-auto'
													: 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
											}`}
										>
											{QUICK_REACTIONS.map((emoji) => (
												<button
													key={emoji}
													type="button"
													onClick={() => handleToggleReaction(msg.id, emoji)}
													className="w-7 h-7 rounded-full hover:bg-white/10 text-[15px] flex items-center justify-center transition cursor-pointer"
													title={`React with ${emoji}`}
												>
													{emoji}
												</button>
											))}
											<button
												type="button"
												onClick={() => triggerReply(msg)}
												className="px-2.5 py-1 rounded-full hover:bg-white/10 text-[13px] font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
											>
												Reply
											</button>
											{msg.content && (
												<button
													type="button"
													onClick={() => handleCopyMessage(msg)}
													className="px-2.5 py-1 rounded-full hover:bg-white/10 text-[13px] font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
												>
													{copiedMsgId === msg.id ? 'Copied' : 'Copy'}
												</button>
											)}
										</div>

										{/* Row: Avatar + Expressive Comic Speech Bubble */}
										<div
											className={`flex items-end gap-3 max-w-[92%] md:max-w-[80%] ${
												msg.isSelf ? 'flex-row-reverse pr-2.5' : 'flex-row'
											}`}
										>
											{/* Incoming Sender Avatar (aligned at bottom so bubble points right from their image!) */}
											{!msg.isSelf && (
												<div className="w-9 h-9 shrink-0 mb-0.5">
													{isLastInGroup ? (
														avatarUrl ? (
															<img
																src={avatarUrl}
																alt={msg.authorName}
																className="w-9 h-9 rounded-full object-cover"
															/>
														) : (
															<div className="w-9 h-9 rounded-full bg-[#242433] text-zinc-200 flex items-center justify-center text-[14px] font-bold">
																{msg.authorName?.[0]?.toUpperCase() || '?'}
															</div>
														)
													) : null}
												</div>
											)}

											{/* Comic Speech Bubble with Pronounced Tail */}
											<div
												className={`relative rounded-[22px] px-4 py-2.5 text-[16px] leading-[1.45] ${
													msg.isSelf
														? 'bg-[#6d28d9] text-white'
														: 'bg-[#17171f] text-zinc-100'
												} ${isLastInGroup ? (msg.isSelf ? 'rounded-br-[6px]' : 'rounded-bl-[6px]') : ''}`}
											>
												{isLastInGroup && (
													<SpeechBubbleTail
														side={msg.isSelf ? 'right' : 'left'}
														color={msg.isSelf ? '#6d28d9' : '#17171f'}
													/>
												)}

												{msg.replyTo && (
													<div className="mb-2 pl-2.5 border-l-2 border-white/40 text-[13px] text-white/75">
														<span className="font-semibold text-white">{msg.replyTo.authorName}: </span>
														<span className="italic">{msg.replyTo.excerpt}</span>
													</div>
												)}

												{msg.attachment && msg.attachment.kind === 'image' && safeMediaUrl(msg.attachment.url) && (
													<img
														src={safeMediaUrl(msg.attachment.url) ?? undefined}
														alt={msg.attachment.filename}
														className="rounded-xl max-h-72 object-cover mb-1.5"
													/>
												)}

												{msg.attachment && msg.attachment.kind === 'video' && safeMediaUrl(msg.attachment.url) && (
													<video
														src={safeMediaUrl(msg.attachment.url) ?? undefined}
														controls
														playsInline
														className="rounded-xl max-h-72 w-full mb-1.5 bg-black"
													/>
												)}

												{msg.attachment && msg.attachment.kind === 'audio' && safeMediaUrl(msg.attachment.url) && (
													<div data-no-pane-swipe="true" className="mb-1.5 rounded-xl bg-black/25 px-3 py-2 space-y-1.5">
														<div className="flex items-center justify-between gap-2 text-[13px] text-white/80">
															<span className="truncate font-medium">{msg.attachment.filename}</span>
															<span className="text-[11px] shrink-0">Voice</span>
														</div>
														<audio
															src={safeMediaUrl(msg.attachment.url) ?? undefined}
															controls
															preload="metadata"
															className="w-full h-9"
														/>
													</div>
												)}

												{msg.attachment && msg.attachment.kind === 'doc' && (
													<div className="mb-1.5 rounded-xl bg-black/25 px-3 py-2 text-[14px] flex items-center justify-between gap-3">
														<span className="font-mono truncate">{msg.attachment.filename}</span>
														<span className="text-[12px] font-semibold shrink-0">Doc</span>
													</div>
												)}

												{msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
											</div>
										</div>

										{/* Sender Name & Time Underneath Bubble + Reactions */}
										{isLastInGroup && (
											<div
												className={`flex items-center gap-2 mt-1 ${
													msg.isSelf ? 'pr-3 justify-end' : 'pl-12 justify-start'
												}`}
											>
												{!msg.isSelf && (
													<span className="text-[12px] font-semibold text-zinc-400">{msg.authorName}</span>
												)}
												<span className="text-[11px] text-zinc-500">{msg.createdAt}</span>
											</div>
										)}

										{msg.reactions && msg.reactions.length > 0 && (
											<div className={`flex gap-1.5 mt-1 ${msg.isSelf ? 'pr-3' : 'pl-12'}`}>
												{msg.reactions.map((r) => (
													<button
														key={r.emoji}
														type="button"
														onClick={() => handleToggleReaction(msg.id, r.emoji)}
														className={`text-[13px] px-2.5 py-0.5 rounded-full transition cursor-pointer ${
															r.reacted
																? 'bg-[#8b5cf6]/30 text-white'
																: 'bg-[#181820] text-zinc-200 hover:bg-[#22222d]'
														}`}
													>
														{r.emoji} {r.count}
													</button>
												))}
											</div>
										)}
									</div>
								)
							})
						)}
						<div ref={messagesEndRef} />
					</div>
				</div>

				{/* Collapsible Space Orb Bar */}
				<SpaceOrbBar
					spaces={activeRealm.spaces}
					activeSpaceId={activeSpace.id}
					expanded={orbBarExpanded}
					onToggleExpanded={() => setOrbBarExpanded((v) => !v)}
					onSelectSpace={(id) => setActiveSpaceId(id)}
				/>

				{/* Reply Highlight Banner */}
				{replyTo && (
					<div className="px-4 py-2 bg-[#161326] border-l-4 border-[#8b5cf6] flex items-center justify-between text-[14px] text-zinc-200">
						<div className="truncate">
							Replying to <span className="text-white font-semibold">{replyTo.authorName}</span>: {replyTo.content}
						</div>
						<button
							type="button"
							aria-label="Cancel reply"
							onClick={() => setReplyTo(null)}
							className="text-zinc-400 hover:text-white ml-3 p-1.5 rounded-full hover:bg-white/10 cursor-pointer shrink-0"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<path d="M18 6L6 18" />
								<path d="M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}

				{/* Message Composer (min-w-0 ensures Send button NEVER clips off screen!) */}
				<form
					onSubmit={handleSendMessage}
					className={`px-3 pt-2.5 bg-[#0e0e13] shrink-0 ${
						openTray === 'none' ? 'pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'pb-2.5'
					}`}
				>
					<div className="max-w-2xl mx-auto flex items-center gap-2 w-full">
						{/* Media Drawer Button */}
						<button
							type="button"
							title="Device gallery, files, camera, and voice"
							aria-label="Open media drawer"
							onClick={() => {
								hapticTap()
								setOpenTray((t) => (t === 'media' ? 'none' : 'media'))
							}}
							className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
								openTray === 'media'
									? 'bg-[#8b5cf6] text-white'
									: 'bg-[#181820] text-zinc-300 hover:text-white'
							}`}
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</button>

						{/* Text Input + Direct Stickers & GIFs Toggle (min-w-0 prevents overflow!) */}
						<div
							className={`flex-1 min-w-0 flex items-center rounded-full bg-[#181820] pl-4 pr-1.5 py-1 transition-shadow ${
								replyPulse || replyTo ? 'ring-2 ring-[#8b5cf6]' : ''
							}`}
						>
							<input
								ref={composerInputRef}
								type="text"
								value={draft}
								onFocus={() => {
									setOrbBarExpanded(false)
									setOpenTray('none')
								}}
								onChange={(e) => setDraft(e.target.value)}
								placeholder={`Message ${activeSpace.name}…`}
								className="flex-1 min-w-0 w-full bg-transparent py-2 text-[16px] text-white placeholder:text-zinc-500 focus:outline-none"
							/>
							<button
								type="button"
								title="Stickers & GIFs"
								aria-label="Open Stickers and GIFs"
								onClick={() => {
									hapticTap()
									setOpenTray((t) => (t === 'stickers' ? 'none' : 'stickers'))
								}}
								className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
									openTray === 'stickers'
										? 'bg-[#8b5cf6] text-white'
										: 'text-zinc-400 hover:text-white hover:bg-white/10'
								}`}
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<circle cx="12" cy="12" r="9" />
									<path d="M8 14s1.5 2 4 2 4-2 4-2" />
									<line x1="9" y1="9" x2="9.01" y2="9" />
									<line x1="15" y1="9" x2="15.01" y2="9" />
								</svg>
							</button>
						</div>

						{/* Crisp Circular Send Button (always visible on screen!) */}
						<button
							type="submit"
							disabled={!draft.trim()}
							aria-label="Send message"
							className="w-11 h-11 rounded-full bg-white text-black hover:bg-zinc-200 disabled:bg-[#181820] disabled:text-zinc-600 flex items-center justify-center transition cursor-pointer shrink-0"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
								<line x1="12" y1="19" x2="12" y2="5" />
								<polyline points="5 12 12 5 19 12" />
							</svg>
						</button>
					</div>
				</form>

				{/* Signal-Style Expandable Device Gallery Drawer */}
				{openTray === 'media' && (
					<AttachmentTray
						spaceId={activeSpace.id}
						galleryItems={deviceGallery}
						onAddGalleryItems={(items) => setDeviceGallery((prev) => [...items, ...prev])}
						onClose={() => setOpenTray('none')}
						onSendAsset={handleSendAsset}
					/>
				)}

				{/* Direct Stickers & GIFs Tray */}
				{openTray === 'stickers' && (
					<StickerGifTray
						spaceId={activeSpace.id}
						onClose={() => setOpenTray('none')}
						onSendSticker={(sticker) => {
							void sendTextContent(sticker)
						}}
						onSendGif={(asset) => {
							void handleSendAsset(asset)
						}}
					/>
				)}
			</main>

			{/* RIGHT PANEL: Space Shared Media, Docs & Links */}
			<div
				className={`fixed inset-y-0 right-0 z-30 w-[88vw] max-w-[350px] lg:static lg:w-[320px] lg:translate-x-0 transition-transform duration-300 ease-out ${
					mobilePane === 'right' ? 'translate-x-0 shadow-2xl shadow-black' : 'translate-x-full'
				}`}
			>
				<RightSpacePanel
					space={activeSpace}
					files={spaceFiles}
					onCloseMobile={() => setMobilePane('center')}
				/>
			</div>

			{/* REALM OVERVIEW & STATS SHEET */}
			{realmOverviewOpen && (
				<RealmOverviewModal
					realm={activeRealm}
					activeSpaceId={activeSpace.id}
					onSelectSpace={(id) => setActiveSpaceId(id)}
					onCreateSpace={() => setCreateSpaceOpen(true)}
					onClose={() => setRealmOverviewOpen(false)}
				/>
			)}

			{/* CREATE REALM MODAL */}
			{createRealmOpen && (
				<CreateRealmModal
					onClose={() => setCreateRealmOpen(false)}
					onSubmit={async (params) => {
						if (session?.access_token) {
							const created = await createRealm(params)
							const mapped = mapApiRealm(created, [])
							setRealms((prev) => [mapped, ...prev])
							setActiveRealmId(mapped.id)
							setActiveSpaceId(mapped.spaces[0].id)
							return created
						}
						const localId = `realm-${Date.now()}`
						const defaultSpace: Space = {
							id: `space-${Date.now()}`,
							realmId: localId,
							name: 'General',
							slug: 'general',
							orbGradient: ORB_GRADIENTS[realms.length % ORB_GRADIENTS.length],
							kind: 'community',
						}
						const newRealm: Realm = {
							id: localId,
							name: params.name,
							slug: params.slug,
							description: params.description,
							coverUrl: params.banner_url || DEFAULT_COVER,
							accentColor: '#8b5cf6',
							spaces: [defaultSpace],
						}
						setRealms((prev) => [newRealm, ...prev])
						setActiveRealmId(newRealm.id)
						setActiveSpaceId(defaultSpace.id)
					}}
				/>
			)}

			{/* CREATE SPACE MODAL */}
			{createSpaceOpen && (
				<CreateSpaceModal
					realmId={activeRealm.id}
					realmName={activeRealm.name}
					currentSpaceCount={activeRealm.spaces.length}
					onClose={() => setCreateSpaceOpen(false)}
					onSubmit={async (params) => {
						if (session?.access_token && isLiveId(activeRealm.id)) {
							const created = await createSpace(params)
							const mapped = mapApiSpace(created, activeRealm.spaces.length)
							setRealms((prev) =>
								prev.map((r) =>
									r.id === activeRealm.id ? { ...r, spaces: [...r.spaces, mapped] } : r
								)
							)
							setActiveSpaceId(mapped.id)
							return created
						}
						const newSpace: Space = {
							id: `space-${Date.now()}`,
							realmId: activeRealm.id,
							name: params.name,
							slug: params.slug,
							description: params.description,
							orbGradient: ORB_GRADIENTS[activeRealm.spaces.length % ORB_GRADIENTS.length],
							kind: (params.kind as Space['kind']) || 'community',
						}
						setRealms((prev) =>
							prev.map((r) =>
								r.id === activeRealm.id ? { ...r, spaces: [...r.spaces, newSpace] } : r
							)
						)
						setActiveSpaceId(newSpace.id)
					}}
				/>
			)}

			{/* CONTEXTUAL SPACE PERSONA MODAL */}
			{personaModalOpen && (
				<SpacePersonaModal
					spaceId={activeSpace.id}
					spaceName={activeSpace.name}
					initialTag={activePersona?.tag || session?.user.username || ''}
					initialDisplayName={activePersona?.display_name || session?.user.display_name || ''}
					initialIsAnonymous={activePersona?.is_anonymous || false}
					defaultDisplayName={session?.user.display_name || 'Concord Member'}
					onClose={() => setPersonaModalOpen(false)}
					onSubmit={async (params) => {
						if (session?.access_token && isLiveId(activeSpace.id)) {
							try {
								await updateSpaceIdentity(activeSpace.id, params)
							} catch (err) {
								if (err instanceof ApiError && err.status === 404) {
									await joinSpace(activeSpace.id)
									await updateSpaceIdentity(activeSpace.id, params)
								} else {
									throw err
								}
							}
						}
						setPersonasBySpace((prev) => ({
							...prev,
							[activeSpace.id]: params,
						}))
					}}
				/>
			)}

			{/* CURATOR REALM NOTE & MUSIC COMPOSER MODAL */}
			{noteModalOpen && (
				<RealmNoteModal
					currentNote={activeRealm.note}
					curatorName={session?.user.display_name || activeRealm.note?.curatorName || 'Galediç'}
					onSave={handleSaveRealmNote}
					onClose={() => setNoteModalOpen(false)}
				/>
			)}
		</div>
	)
}
