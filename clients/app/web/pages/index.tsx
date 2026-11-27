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
import { uploadFile } from '../../lib/storage'
import { isUuid, safeMediaUrl } from '../../lib/url'
import type { ChatMessage, FileAsset, Realm, RoomViewMode, Space } from '../../lib/types'
import { AttachmentTray, type DeviceGalleryItem } from '../components/AttachmentTray'
import {
	ForwardMessageSheet,
	ImageLightbox,
	MessageContextMenu,
	MessageInfoPopover,
	SettingsSheet,
} from '../components/ChatOverlays'
import { CreateRealmModal, CreateSpaceModal } from '../components/CreateModals'
import {
	DocumentMessageCard,
	ImageGroupCard,
	LinkPreviewCard,
	VideoMessageCard,
	VoiceNotePlayer,
	extractFirstUrl,
} from '../components/MessageMedia'
import { LeftRealmsPanel } from '../components/LeftRealmsPanel'
import { RightSpacePanel } from '../components/RightSpacePanel'
import { SpaceDetailsDrawer, type SpacePersonaState } from '../components/SpaceDetailsDrawer'
import { SpaceOrbBar } from '../components/SpaceOrbBar'
import { StickerGifTray } from '../components/StickerGifTray'

export const metadata = { title: 'Concord' }

const VIEW_MODE_KEY = 'concord_realms_view_mode_v2'
const QUICK_REACTIONS = ['✦', '🔥', '❤️', '👏', '😂']
const VOICE_LEVEL_BAR_COUNT = 18

const ORB_GRADIENTS = [
	'from-[#244438] to-[#172c24]',
	'from-[#524236] to-[#372c24]',
	'from-[#354c3a] to-[#233327]',
	'from-[#284748] to-[#1a3031]',
	'from-[#4b563c] to-[#323a28]',
	'from-[#3e463b] to-[#282e26]',
	'from-[#4d4136] to-[#332a22]',
]

const DEFAULT_COVER =
	'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'

function formatTime(iso?: string): string {
	if (!iso) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatVoiceSeconds(sec: number): string {
	const safe = Math.max(0, Math.floor(sec))
	const m = Math.floor(safe / 60)
	const s = safe % 60
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function pickSupportedAudioMime(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined
	const candidates = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/mp4',
		'audio/ogg;codecs=opus',
		'audio/ogg',
	]
	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) return mime
	}
	return undefined
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

function SpeechBubbleTail({ side, color }: { side: 'left' | 'right'; color: string }) {
	if (side === 'left') {
		return (
			<svg
				className="absolute -left-[10px] bottom-[3px] w-[14px] h-[16px] pointer-events-none"
				viewBox="0 0 14 16"
				fill="none"
				aria-hidden="true"
			>
				<path d="M14 0C14 7.5 8 13.5 0.5 15C4.5 11.2 6.5 7 6.5 0H14Z" fill={color} />
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
			<path d="M0 0C0 7.5 6 13.5 13.5 15C9.5 11.2 7.5 7 7.5 0H0Z" fill={color} />
		</svg>
	)
}

export default function ConcordAppPage() {
	const [session, setSession] = useState<ConcordSession | null>(null)
	const [viewMode, setViewMode] = useState<RoomViewMode>(() => {
		if (typeof window === 'undefined') return 'grid-visual'
		const saved = localStorage.getItem(VIEW_MODE_KEY)
		if (saved === 'grid-titled' || saved === 'grid-visual' || saved === 'list') return saved
		return 'grid-visual'
	})
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [realms, setRealms] = useState<Realm[]>(INITIAL_REALMS)
	const [activeRealmId, setActiveRealmId] = useState(INITIAL_REALMS[0].id)
	const [activeSpaceId, setActiveSpaceId] = useState(INITIAL_REALMS[0].spaces[0].id)

	const [messagesBySpace, setMessagesBySpace] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES)
	const [filesBySpace, setFilesBySpace] = useState<Record<string, FileAsset[]>>(INITIAL_FILES)
	const [personasBySpace, setPersonasBySpace] = useState<Record<string, SpacePersonaState>>({})

	// Device gallery items persisted across tray opens in this session
	const [deviceGallery, setDeviceGallery] = useState<DeviceGalleryItem[]>([])

	const [draft, setDraft] = useState('')
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
	const [replyPulse, setReplyPulse] = useState(false)
	const [orbBarExpanded, setOrbBarExpanded] = useState(false)
	const [openTray, setOpenTray] = useState<'none' | 'media' | 'stickers'>('none')
	const [spaceDrawerOpen, setSpaceDrawerOpen] = useState(false)

	// Action modals
	const [createRealmOpen, setCreateRealmOpen] = useState(false)
	const [createSpaceOpen, setCreateSpaceOpen] = useState(false)

	// Inline Voice Note Recorder state
	const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false)
	const [isRecordingVoice, setIsRecordingVoice] = useState(false)
	const [isUploadingVoice, setIsUploadingVoice] = useState(false)
	const [voiceSeconds, setVoiceSeconds] = useState(0)
	const [voiceLevelBars, setVoiceLevelBars] = useState<number[]>(() =>
		Array(VOICE_LEVEL_BAR_COUNT).fill(18)
	)
	const voiceRecorderRef = useRef<MediaRecorder | null>(null)
	const voiceStreamRef = useRef<MediaStream | null>(null)
	const voiceAudioCtxRef = useRef<AudioContext | null>(null)
	const voiceAnimFrameRef = useRef<number | null>(null)
	const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const voiceStartRef = useRef<number>(0)
	const voiceChunksRef = useRef<Blob[]>([])
	const voiceActionRef = useRef<'send' | 'cancel'>('cancel')
	const voiceStartingRef = useRef(false)
	const isMountedRef = useRef(true)
	const voiceObjectUrlsRef = useRef<Set<string>>(new Set())

	// Long-press context menu (anchored popover), message info (Check), selection mode
	const [contextMenu, setContextMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null)
	const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null)
	const [lightboxImage, setLightboxImage] = useState<{ url: string; filename: string } | null>(null)
	const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null)
	const [selectionMode, setSelectionMode] = useState(false)
	const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(() => new Set())
	const [keptMsgIds, setKeptMsgIds] = useState<Set<string>>(() => new Set())
	const [toastMsg, setToastMsg] = useState<string | null>(null)

	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)
	const longPressTriggeredRef = useRef(false)
	const lastTapRef = useRef<{ msgId: string; time: number } | null>(null)
	const replyPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
	const activePersona: SpacePersonaState = personasBySpace[activeSpace.id] || {
		title: session?.user.display_name || 'You',
		mood: '',
		tag: session?.user.username || '',
		is_anonymous: false,
	}

	const showToast = (msg: string) => {
		setToastMsg(msg)
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
		toastTimerRef.current = setTimeout(() => setToastMsg(null), 1800)
	}

	useEffect(() => {
		setSession(getSession())

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

	const cleanupVoiceInternals = () => {
		if (voiceAnimFrameRef.current !== null) {
			cancelAnimationFrame(voiceAnimFrameRef.current)
			voiceAnimFrameRef.current = null
		}
		if (voiceTimerRef.current !== null) {
			clearInterval(voiceTimerRef.current)
			voiceTimerRef.current = null
		}
		if (voiceAudioCtxRef.current) {
			void voiceAudioCtxRef.current.close().catch(() => {})
			voiceAudioCtxRef.current = null
		}
		if (voiceStreamRef.current) {
			voiceStreamRef.current.getTracks().forEach((t) => t.stop())
			voiceStreamRef.current = null
		}
	}

	const cancelVoiceRecording = () => {
		voiceActionRef.current = 'cancel'
		const recorder = voiceRecorderRef.current
		if (recorder && recorder.state !== 'inactive') {
			recorder.onstop = null
			recorder.stop()
		}
		voiceRecorderRef.current = null
		voiceChunksRef.current = []
		cleanupVoiceInternals()
		setIsRecordingVoice(false)
		setVoiceRecorderOpen(false)
		setVoiceSeconds(0)
		setVoiceLevelBars(Array(VOICE_LEVEL_BAR_COUNT).fill(18))
	}

	useEffect(() => {
		setContextMenu(null)
		setInfoMsg(null)
		setSelectionMode(false)
		setSelectedMsgIds(new Set())
		setReplyTo(null)
		setOpenTray('none')
		cancelVoiceRecording()
	}, [activeSpace.id])

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
			if (replyPulseTimerRef.current) clearTimeout(replyPulseTimerRef.current)
			if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
			if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
				voiceRecorderRef.current.onstop = null
				voiceRecorderRef.current.stop()
			}
			cleanupVoiceInternals()
			for (const url of voiceObjectUrlsRef.current) {
				URL.revokeObjectURL(url)
			}
			voiceObjectUrlsRef.current.clear()
		}
	}, [])

	const openContextMenuAt = (msg: ChatMessage, clientX: number, clientY: number) => {
		const menuW = 228
		const menuH = 340
		const vw = typeof window !== 'undefined' ? window.innerWidth : 390
		const vh = typeof window !== 'undefined' ? window.innerHeight : 844
		const x = Math.max(12, Math.min(clientX - menuW / 2, vw - menuW - 12))
		const y = Math.max(16, Math.min(clientY - 40, vh - menuH - 16))
		setContextMenu({ msg, x, y })
	}

	const triggerReply = (msg: ChatMessage) => {
		hapticReply()
		setReplyTo(msg)
		setContextMenu(null)
		setOpenTray('none')
		setOrbBarExpanded(false)
		setReplyPulse(true)
		if (replyPulseTimerRef.current) clearTimeout(replyPulseTimerRef.current)
		replyPulseTimerRef.current = setTimeout(() => setReplyPulse(false), 700)
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

	const sendTextContent = async (rawText: string, targetSpaceId = activeSpace.id) => {
		const text = rawText.trim()
		if (!text) return

		hapticTap()
		const tempId = newTempId()
		const currentReply = targetSpaceId === activeSpace.id ? replyTo : null
		const newMsg: ChatMessage = {
			id: tempId,
			spaceId: targetSpaceId,
			authorId: session?.user.id || 'self',
			authorName: activePersona.is_anonymous
				? 'Anonymous'
				: activePersona.title || session?.user.display_name || 'You',
			authorHandle: activePersona.tag || session?.user.username || 'galediç',
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
		if (targetSpaceId === activeSpace.id) {
			setDraft('')
			setReplyTo(null)
		}

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
				// Keep optimistic message
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
			authorName: activePersona.title || session?.user.display_name || 'You',
			authorHandle: activePersona.tag || session?.user.username || 'galediç',
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
		setContextMenu(null)

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
			showToast('Copied text')
		} catch {
			showToast('Could not copy')
		}
		setContextMenu(null)
	}

	const handleDeleteMessages = (ids: string[]) => {
		hapticTap()
		const idSet = new Set(ids)
		setMessagesBySpace((prev) => ({
			...prev,
			[activeSpace.id]: (prev[activeSpace.id] || []).filter((m) => !idSet.has(m.id)),
		}))
		setContextMenu(null)
		setInfoMsg(null)
		setSelectionMode(false)
		setSelectedMsgIds(new Set())
		showToast(ids.length > 1 ? `Deleted ${ids.length} messages` : 'Message deleted')
	}

	const toggleSelectMsg = (id: string) => {
		hapticTap()
		setSelectedMsgIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			if (next.size === 0) setSelectionMode(false)
			return next
		})
	}

	const toggleKeptMsg = (id: string) => {
		hapticTap()
		setKeptMsgIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
				showToast('Removed from Kept')
			} else {
				next.add(id)
				showToast('Message kept')
			}
			return next
		})
		setContextMenu(null)
	}

	const startInlineVoiceRecording = async () => {
		if (isRecordingVoice || voiceStartingRef.current || isUploadingVoice) return
		if (
			typeof navigator === 'undefined' ||
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			showToast('Voice recording is not supported here')
			return
		}
		hapticTap()
		setOpenTray('none')
		setOrbBarExpanded(false)
		voiceStartingRef.current = true
		voiceActionRef.current = 'cancel'
		const recordingSpaceId = activeSpace.id

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			if (!isMountedRef.current) {
				stream.getTracks().forEach((t) => t.stop())
				return
			}
			voiceStreamRef.current = stream
			voiceChunksRef.current = []
			const mimeType = pickSupportedAudioMime()
			const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
			voiceRecorderRef.current = recorder

			recorder.onerror = () => {
				cancelVoiceRecording()
			}

			recorder.ondataavailable = (ev) => {
				if (ev.data.size > 0) voiceChunksRef.current.push(ev.data)
			}

			recorder.onstop = async () => {
				const shouldSend = voiceActionRef.current === 'send'
				const finalMime = recorder.mimeType || mimeType || 'audio/webm'
				const blob = new Blob(voiceChunksRef.current, { type: finalMime })
				voiceChunksRef.current = []
				voiceRecorderRef.current = null
				cleanupVoiceInternals()
				if (!isMountedRef.current) return
				setIsRecordingVoice(false)

				if (!shouldSend || blob.size === 0) {
					setVoiceRecorderOpen(false)
					setVoiceSeconds(0)
					setVoiceLevelBars(Array(VOICE_LEVEL_BAR_COUNT).fill(18))
					return
				}

				setIsUploadingVoice(true)
				let tempBlobUrl: string | null = null
				try {
					const ext = finalMime.includes('mp4')
						? 'm4a'
						: finalMime.includes('ogg')
							? 'ogg'
							: 'webm'
					const cleanMime = finalMime.split(';')[0] || `audio/${ext}`
					const audioFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: cleanMime })
					const isLiveSignedIn = Boolean(session?.access_token && isLiveId(recordingSpaceId))

					let asset: FileAsset
					try {
						const uploaded = await uploadFile(
							audioFile,
							isLiveId(recordingSpaceId) ? recordingSpaceId : undefined
						)
						asset = {
							id: uploaded.id,
							spaceId: recordingSpaceId,
							filename: uploaded.filename,
							contentType: uploaded.content_type,
							sizeBytes: uploaded.size_bytes,
							url: uploaded.url,
							kind: 'audio',
							createdAt: 'Just now',
						}
					} catch (err) {
						if (isLiveSignedIn) {
							throw err instanceof Error ? err : new Error('Voice upload failed')
						}
						tempBlobUrl = URL.createObjectURL(blob)
						voiceObjectUrlsRef.current.add(tempBlobUrl)
						asset = {
							id: `local-${Date.now()}`,
							spaceId: recordingSpaceId,
							filename: audioFile.name,
							contentType: cleanMime,
							sizeBytes: audioFile.size,
							url: tempBlobUrl,
							kind: 'audio',
							createdAt: 'Just now',
						}
					}

					if (!isMountedRef.current) {
						if (tempBlobUrl) {
							voiceObjectUrlsRef.current.delete(tempBlobUrl)
							URL.revokeObjectURL(tempBlobUrl)
						}
						return
					}
					await handleSendAsset(asset)
				} catch (err) {
					if (tempBlobUrl) {
						voiceObjectUrlsRef.current.delete(tempBlobUrl)
						URL.revokeObjectURL(tempBlobUrl)
					}
					showToast(err instanceof Error ? err.message : 'Voice upload failed')
				} finally {
					if (isMountedRef.current) {
						setIsUploadingVoice(false)
						setVoiceRecorderOpen(false)
						setVoiceSeconds(0)
						setVoiceLevelBars(Array(VOICE_LEVEL_BAR_COUNT).fill(18))
					}
				}
			}

			try {
				const AudioCtx =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				const audioCtx = new AudioCtx()
				voiceAudioCtxRef.current = audioCtx
				const source = audioCtx.createMediaStreamSource(stream)
				const analyser = audioCtx.createAnalyser()
				analyser.fftSize = 64
				source.connect(analyser)
				const freqData = new Uint8Array(analyser.frequencyBinCount)
				const tick = () => {
					analyser.getByteFrequencyData(freqData)
					const bars: number[] = []
					const step = Math.max(1, Math.floor(freqData.length / VOICE_LEVEL_BAR_COUNT))
					for (let i = 0; i < VOICE_LEVEL_BAR_COUNT; i++) {
						const val = freqData[i * step] ?? 0
						bars.push(Math.max(16, Math.min(100, Math.round((val / 255) * 100))))
					}
					setVoiceLevelBars(bars)
					voiceAnimFrameRef.current = requestAnimationFrame(tick)
				}
				voiceAnimFrameRef.current = requestAnimationFrame(tick)
			} catch {
				// Fallback to static bars if WebAudio is unavailable
			}

			voiceStartRef.current = Date.now()
			setVoiceSeconds(0)
			setVoiceRecorderOpen(true)
			setIsRecordingVoice(true)
			recorder.start(200)
			voiceTimerRef.current = setInterval(() => {
				setVoiceSeconds(Math.floor((Date.now() - voiceStartRef.current) / 1000))
			}, 250)
		} catch (err) {
			cleanupVoiceInternals()
			setIsRecordingVoice(false)
			setVoiceRecorderOpen(false)
			showToast(err instanceof Error ? err.message : 'Microphone access denied')
		} finally {
			voiceStartingRef.current = false
		}
	}

	const stopAndSendVoiceRecording = () => {
		hapticTap()
		voiceActionRef.current = 'send'
		if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
			voiceRecorderRef.current.stop()
		} else {
			cancelVoiceRecording()
		}
	}

	// Touch handlers: long-press vibration + context menu, double-tap instant reply
	const onMessageTouchStart = (msg: ChatMessage, e: React.TouchEvent) => {
		if (selectionMode) return
		const t = e.touches[0]
		const tx = t.clientX
		const ty = t.clientY
		longPressOriginRef.current = { x: tx, y: ty }
		longPressTriggeredRef.current = false
		if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
		longPressTimerRef.current = setTimeout(() => {
			longPressTriggeredRef.current = true
			hapticMenu()
			openContextMenuAt(msg, tx, ty)
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
		if (selectionMode) {
			toggleSelectMsg(msg.id)
			return
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
			className="h-[100dvh] w-full overflow-hidden bg-[#050a08] text-[#e5ebcd] flex relative select-none"
		>
			{/* LEFT PANEL: Visual Realms Grid */}
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
					onOpenSettings={() => setSettingsOpen(true)}
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

			{mobilePane === 'left' && (
				<button
					type="button"
					aria-label="Close realms drawer"
					onClick={() => setMobilePane('center')}
					className="fixed inset-0 z-20 bg-black/60 lg:hidden"
				/>
			)}

			{/* CENTER STAGE: Active Space Conversation */}
			<main className="flex-1 min-w-0 h-full flex flex-col bg-[#050a08] relative">
				{/* Transparent Floating Top Bar: ONLY the Centered Floating Space Orb + Pill Name */}
				{selectionMode ? (
					<header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-3 shrink-0 bg-[#241f1b] z-20">
						<button
							type="button"
							onClick={() => {
								setSelectionMode(false)
								setSelectedMsgIds(new Set())
							}}
							className="text-[14px] font-semibold text-[#9e998c] hover:text-[#edf3d2] cursor-pointer"
						>
							Cancel
						</button>
						<span className="text-[15px] font-bold text-[#edf3d2]">
							{selectedMsgIds.size} selected
						</span>
						<button
							type="button"
							onClick={() => handleDeleteMessages(Array.from(selectedMsgIds))}
							className="text-[14px] font-semibold text-red-400 hover:text-red-300 cursor-pointer"
						>
							Delete
						</button>
					</header>
				) : (
					<header className="pointer-events-none absolute top-0 inset-x-0 z-20 pt-[max(0.7rem,env(safe-area-inset-top))] pb-2 flex justify-center bg-transparent">
						<button
							type="button"
							onClick={() => {
								hapticTap()
								setSpaceDrawerOpen(true)
							}}
							className="pointer-events-auto flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
							title="Space details & persona"
						>
							<div className="relative">
								<div
									className={`w-11 h-11 rounded-full bg-gradient-to-br ${activeSpace.orbGradient} flex items-center justify-center text-[15px] font-bold text-[#edf3d2] shadow-lg shadow-black/45 group-hover:scale-105 transition`}
								>
									{activeSpace.name[0]}
								</div>
								{socketState === 'connected' && (
									<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#cedb9c] ring-2 ring-[#050a08]" />
								)}
							</div>
							<div className="inline-flex items-center gap-1 px-3.5 py-0.5 rounded-full bg-[#2a241f]/90 backdrop-blur-md shadow-md shadow-black/35 group-hover:bg-[#352e27] transition max-w-[200px]">
								<span className="text-[13px] font-semibold text-[#edf3d2] truncate">
									{activeSpace.name}
								</span>
							</div>
						</button>
					</header>
				)}

				{/* Toast Feedback */}
				{toastMsg && (
					<div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-[#cedb9c] text-[#1d1916] text-[13px] font-bold shadow-xl">
						{toastMsg}
					</div>
				)}

				{/* Conversation Stream (Generous Reading Width + Scrolls Smoothly Beneath Transparent Header & Bottom Dock) */}
				<div
					className={`flex-1 overflow-y-auto px-2.5 md:px-6 pt-[calc(5.2rem+env(safe-area-inset-top))] ${
						openTray === 'none' ? (orbBarExpanded ? 'pb-52' : 'pb-28') : 'pb-4'
					}`}
				>
					<div className="max-w-2xl mx-auto flex flex-col">
						{messages.length === 0 ? (
							<div className="text-center py-20 space-y-2">
								<div className="text-[18px] font-editorial italic text-[#9e998c]">
									“{activeSpace.name}” is quiet.
								</div>
								<p className="text-[14px] text-[#7a7569]">Write the first line below.</p>
							</div>
						) : (
							messages.map((msg, idx) => {
								const prev = idx > 0 ? messages[idx - 1] : null
								const next = idx < messages.length - 1 ? messages[idx + 1] : null
								const sameAuthorAsPrev = Boolean(prev && prev.authorId === msg.authorId && prev.isSelf === msg.isSelf)
								const isLastInGroup = !next || next.authorId !== msg.authorId || next.isSelf !== msg.isSelf
								const avatarUrl = safeMediaUrl(msg.authorAvatar)
								const isSelected = selectedMsgIds.has(msg.id)
								const isKept = keptMsgIds.has(msg.id)

								return (
									<div
										key={msg.id}
										onDoubleClick={() => !selectionMode && triggerReply(msg)}
										onContextMenu={(e) => {
											e.preventDefault()
											hapticMenu()
											openContextMenuAt(msg, e.clientX, e.clientY)
										}}
										onClick={() => selectionMode && toggleSelectMsg(msg.id)}
										onTouchStart={(e) => onMessageTouchStart(msg, e)}
										onTouchMove={onMessageTouchMove}
										onTouchEnd={(e) => onMessageTouchEnd(msg, e)}
										onTouchCancel={() => {
											if (longPressTimerRef.current) {
												clearTimeout(longPressTimerRef.current)
												longPressTimerRef.current = null
											}
										}}
										className={`group relative flex flex-col rounded-2xl transition-colors ${
											isSelected ? 'bg-[#cedb9c]/12 px-1.5 py-1' : ''
										} ${msg.isSelf ? 'items-end' : 'items-start'} ${
											idx === 0 ? '' : sameAuthorAsPrev ? 'mt-1.5' : 'mt-4'
										}`}
									>
										<div
											className={`flex items-end gap-2 w-full ${
												msg.isSelf ? 'justify-end pr-2' : 'justify-start'
											}`}
										>
											{selectionMode && (
												<span
													className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mb-2 ${
														isSelected
															? 'bg-[#cedb9c] border-[#cedb9c] text-[#1d1916]'
															: 'border-[#7a7569]'
													}`}
												>
													{isSelected && (
														<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
															<polyline points="20 6 9 17 4 12" />
														</svg>
													)}
												</span>
											)}

											{!msg.isSelf && (
												<div className="w-7 h-7 shrink-0 mb-0.5">
													{isLastInGroup ? (
														avatarUrl ? (
															<img
																src={avatarUrl}
																alt={msg.authorName}
																className="w-7 h-7 rounded-full object-cover"
															/>
														) : (
															<div className="w-7 h-7 rounded-full bg-[#2f2923] text-[#e5ebcd] flex items-center justify-center text-[12px] font-bold">
																{msg.authorName?.[0]?.toUpperCase() || '?'}
															</div>
														)
													) : null}
												</div>
											)}

												{(() => {
													const att = msg.attachment
													const mediaUrl = att ? safeMediaUrl(att.url) : null
													const isStandaloneMedia =
														Boolean(att && !msg.content && !msg.replyTo && (att.kind === 'image' || att.kind === 'video' || att.kind === 'doc'))
													const firstUrl = msg.content ? extractFirstUrl(msg.content) : null

													if (isStandaloneMedia && att) {
														return (
															<div className="max-w-[85%] md:max-w-[72%]">
																{att.kind === 'image' && mediaUrl && (
																	<ImageGroupCard
																		images={[{ id: att.id, url: mediaUrl, filename: att.filename }]}
																		onOpenLightbox={(url, filename) => setLightboxImage({ url, filename })}
																	/>
																)}
																{att.kind === 'video' && mediaUrl && (
																	<VideoMessageCard url={mediaUrl} filename={att.filename} />
																)}
																{att.kind === 'doc' && (
																	<DocumentMessageCard asset={att} url={mediaUrl} />
																)}
															</div>
														)
													}

													return (
														<div
															className={`relative max-w-[88%] md:max-w-[78%] rounded-[22px] px-3.5 py-2.5 text-[16px] leading-[1.46] ${
																msg.isSelf
																	? 'bg-[#0d1c16] text-[#f2fbd0]'
																	: 'bg-[#2d2722] text-[#e5ebcd]'
															} ${isLastInGroup ? (msg.isSelf ? 'rounded-br-[6px]' : 'rounded-bl-[6px]') : ''}`}
														>
															{isLastInGroup && (
																<SpeechBubbleTail
																	side={msg.isSelf ? 'right' : 'left'}
																	color={msg.isSelf ? '#0d1c16' : '#2d2722'}
																/>
															)}

															{msg.replyTo && (
																<div className="mb-2 pl-2.5 border-l-2 border-[#cedb9c]/65 text-[13px] text-[#cedb9c]/85">
																	<span className="font-semibold text-[#edf3d2]">{msg.replyTo.authorName}: </span>
																	<span className="italic">{msg.replyTo.excerpt}</span>
																</div>
															)}

															{att && att.kind === 'image' && mediaUrl && (
																<div className="mb-2">
																	<ImageGroupCard
																		images={[{ id: att.id, url: mediaUrl, filename: att.filename }]}
																		onOpenLightbox={(url, filename) => setLightboxImage({ url, filename })}
																	/>
																</div>
															)}

															{att && att.kind === 'video' && mediaUrl && (
																<div className="mb-2">
																	<VideoMessageCard url={mediaUrl} filename={att.filename} />
																</div>
															)}

															{att && att.kind === 'audio' && mediaUrl && (
																<VoiceNotePlayer asset={att} url={mediaUrl} isSelf={msg.isSelf} />
															)}

															{att && att.kind === 'doc' && (
																<div className="mb-2">
																	<DocumentMessageCard asset={att} url={mediaUrl} />
																</div>
															)}

															{msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
															{firstUrl && <LinkPreviewCard url={firstUrl} />}
														</div>
													)
												})()}
										</div>

										{/* Sender Name, Timestamp & Kept Indicator Underneath Bubble */}
										{(isLastInGroup || isKept) && (
											<div
												className={`flex items-center gap-2 mt-1 ${
													msg.isSelf ? 'pr-2.5 justify-end' : 'pl-9 justify-start'
												}`}
											>
												{!msg.isSelf && isLastInGroup && (
													<span className="text-[12px] font-semibold text-[#b8b3a5]">{msg.authorName}</span>
												)}
												{isLastInGroup && (
													<span className="text-[11px] text-[#8a8478]">{msg.createdAt}</span>
												)}
												{isKept && (
													<span className="text-[11px] font-semibold text-[#cedb9c]">Kept</span>
												)}
											</div>
										)}

										{msg.reactions && msg.reactions.length > 0 && (
											<div className={`flex gap-1.5 mt-1 ${msg.isSelf ? 'pr-2.5' : 'pl-9'}`}>
												{msg.reactions.map((r) => (
													<button
														key={r.emoji}
														type="button"
														onClick={(e) => {
															e.stopPropagation()
															void handleToggleReaction(msg.id, r.emoji)
														}}
														className={`text-[13px] px-2.5 py-0.5 rounded-full transition cursor-pointer ${
															r.reacted
																? 'bg-[#0d1c16] text-[#f2fbd0]'
																: 'bg-[#2a241f] text-[#e5ebcd] hover:bg-[#352e27]'
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

				{/* Floating Transparent Bottom Dock (Space Orb Arc + Reply + Composer) */}
				<div
					className={
						openTray === 'none'
							? 'pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col bg-transparent'
							: 'relative z-20 flex flex-col bg-transparent shrink-0'
					}
				>
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
						<div className="pointer-events-auto mx-2.5 mb-1.5 rounded-2xl px-4 py-2 bg-[#26211c]/95 backdrop-blur-md border-l-4 border-[#cedb9c] flex items-center justify-between text-[14px] text-[#e5ebcd] shadow-lg">
							<div className="truncate">
								Replying to <span className="text-[#edf3d2] font-semibold">{replyTo.authorName}</span>: {replyTo.content}
							</div>
							<button
								type="button"
								aria-label="Cancel reply"
								onClick={() => setReplyTo(null)}
								className="text-[#9e998c] hover:text-[#edf3d2] ml-3 p-1.5 rounded-full hover:bg-white/10 cursor-pointer shrink-0"
							>
								<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
									<path d="M18 6L6 18" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
						</div>
					)}

					{/* Message Composer & Inline Voice Note Recorder */}
					<form
						onSubmit={handleSendMessage}
						className="pointer-events-auto px-2.5 pt-1 pb-2 bg-transparent shrink-0"
					>
					{voiceRecorderOpen ? (
						<div className="max-w-2xl mx-auto flex items-center gap-1.5 w-full">
							<button
								type="button"
								onClick={cancelVoiceRecording}
								disabled={isUploadingVoice}
								aria-label="Cancel voice recording"
								title="Cancel recording"
								className="w-10 h-10 rounded-full bg-[#2a241f] text-[#e5ebcd] hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 flex items-center justify-center transition cursor-pointer shrink-0"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
									<path d="M18 6L6 18" />
									<path d="M6 6l12 12" />
								</svg>
							</button>

							<div className="flex-1 min-w-0 h-10 rounded-full bg-[#2a241f] px-3 flex items-center gap-2.5">
								<span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse shrink-0" />
								<span className="text-[13px] font-mono font-semibold text-[#eef7c8] tabular-nums shrink-0">
									{isUploadingVoice ? 'Sending…' : formatVoiceSeconds(voiceSeconds)}
								</span>
								<div className="flex-1 min-w-0 flex items-center justify-between gap-[2px] h-6 overflow-hidden">
									{voiceLevelBars.map((height, idx) => (
										<span
											key={idx}
											className="flex-1 rounded-full bg-[#cedb9c]/85 transition-[height] duration-75"
											style={{ height: `${Math.max(18, height)}%` }}
										/>
									))}
								</div>
							</div>

							<button
								type="button"
								onClick={stopAndSendVoiceRecording}
								disabled={isUploadingVoice}
								aria-label="Stop and send voice note"
								title="Stop and send voice note"
								className="w-10 h-10 rounded-full bg-[#0d1c16] text-[#eef7c8] hover:bg-[#0a120f] disabled:opacity-50 flex items-center justify-center transition cursor-pointer shrink-0"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
									<path d="M12 19l7-7 3 3-7 7-3-3z" />
									<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
									<path d="M2 2l7.586 7.586" />
									<circle cx="11" cy="11" r="1.5" fill="currentColor" stroke="none" />
								</svg>
							</button>
						</div>
					) : (
						<div className="max-w-2xl mx-auto flex items-center gap-1.5 w-full">
							{/* 1. Far Left: Cloud-Paperclip / Folio-Attach Button */}
							<button
								type="button"
								title="Device gallery, files, and camera"
								aria-label="Open media drawer"
								onClick={() => {
									hapticTap()
									setOpenTray((t) => (t === 'media' ? 'none' : 'media'))
								}}
								className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
									openTray === 'media'
										? 'bg-[#cedb9c] text-[#1d1916]'
										: 'bg-[#2a241f] text-[#e5ebcd] hover:bg-[#352e27]'
								}`}
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
									<path d="M7.5 17H6a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 16.3 7.5a3.75 3.75 0 0 1 1.7 7.1" />
									<path d="M14.8 11.8l-4.1 4.1a2.1 2.1 0 0 0 3 3l4.6-4.6a3.3 3.3 0 0 0-4.7-4.7l-4.2 4.2" />
								</svg>
							</button>

							{/* 2. Center: Shorter Espresso Input Box + Stickers & GIFs Button */}
							<div
								className={`flex-1 min-w-0 flex items-center rounded-full bg-[#2a241f] pl-3.5 pr-1 py-0.5 transition-shadow ${
									replyPulse || replyTo ? 'ring-2 ring-[#cedb9c]' : ''
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
									className="flex-1 min-w-0 w-full bg-transparent py-2 text-[15px] text-[#edf3d2] placeholder:text-[#8f897c] focus:outline-none"
								/>
								<button
									type="button"
									title="Stickers & GIFs"
									aria-label="Open Stickers and GIFs"
									onClick={() => {
										hapticTap()
										setOpenTray((t) => (t === 'stickers' ? 'none' : 'stickers'))
									}}
									className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
										openTray === 'stickers'
											? 'bg-[#cedb9c] text-[#1d1916]'
											: 'text-[#9e998c] hover:text-[#edf3d2] hover:bg-white/10'
									}`}
								>
									<svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<circle cx="12" cy="12" r="9" />
										<path d="M8 14s1.5 2 4 2 4-2 4-2" />
										<line x1="9" y1="9" x2="9.01" y2="9" />
										<line x1="15" y1="9" x2="15.01" y2="9" />
									</svg>
								</button>
							</div>

							{/* 3. Right of Input: Fountain Pen Nib Send Button */}
							<button
								type="submit"
								disabled={!draft.trim()}
								aria-label="Send message"
								title="Send message"
								className="w-10 h-10 rounded-full bg-[#cedb9c] text-[#1d1916] hover:bg-[#dce7b0] disabled:bg-[#2a241f] disabled:text-[#6e695e] flex items-center justify-center transition cursor-pointer shrink-0"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M12 19l7-7 3 3-7 7-3-3z" />
									<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
									<path d="M2 2l7.586 7.586" />
									<circle cx="11" cy="11" r="1.5" fill="currentColor" stroke="none" />
								</svg>
							</button>

							{/* 4. Far Right Edge: Dedicated Voice Note Mic Bubble */}
							<button
								type="button"
								aria-label="Record voice note"
								title="Record voice note"
								onClick={() => void startInlineVoiceRecording()}
								className="w-10 h-10 rounded-full bg-[#2a241f] text-[#e5ebcd] hover:bg-[#0d1c16] hover:text-[#eef7c8] flex items-center justify-center transition cursor-pointer shrink-0"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<rect x="9" y="2.5" width="6" height="11" rx="3" />
									<path d="M5 10.5a7 7 0 0 0 14 0" />
									<line x1="12" y1="17.5" x2="12" y2="21.5" />
									<line x1="8.5" y1="21.5" x2="15.5" y2="21.5" />
								</svg>
							</button>
						</div>
					)}
				</form>
				</div>

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
				/>
			</div>

			{contextMenu && (
				<MessageContextMenu
					msg={contextMenu.msg}
					x={contextMenu.x}
					y={contextMenu.y}
					isKept={keptMsgIds.has(contextMenu.msg.id)}
					onClose={() => setContextMenu(null)}
					onToggleReaction={(msgId, emoji) => void handleToggleReaction(msgId, emoji)}
					onReply={triggerReply}
					onCopy={(msg) => void handleCopyMessage(msg)}
					onSelect={(msgId) => {
						setSelectionMode(true)
						setSelectedMsgIds(new Set([msgId]))
						setContextMenu(null)
					}}
					onForward={(msg) => {
						setForwardMsg(msg)
						setContextMenu(null)
					}}
					onToggleKeep={toggleKeptMsg}
					onCheckInfo={(msg) => {
						setInfoMsg(msg)
						setContextMenu(null)
					}}
					onDelete={(msgId) => handleDeleteMessages([msgId])}
				/>
			)}

			{infoMsg && <MessageInfoPopover msg={infoMsg} onClose={() => setInfoMsg(null)} />}

			{forwardMsg && (
				<ForwardMessageSheet
					spaces={activeRealm.spaces}
					onForwardToSpace={(sp) => {
						void sendTextContent(forwardMsg.content || forwardMsg.attachment?.filename || '', sp.id)
						setForwardMsg(null)
						showToast(`Forwarded to ${sp.name}`)
					}}
					onClose={() => setForwardMsg(null)}
				/>
			)}

			{/* SPACE DETAILS + PERSONA DRAWER (Opened by tapping top centered Space Orb + Pill) */}
			{spaceDrawerOpen && (
				<SpaceDetailsDrawer
					realm={activeRealm}
					space={activeSpace}
					role="curator"
					persona={activePersona}
					defaultTitle={session?.user.display_name || 'Concord Member'}
					onSelectSpace={(id) => setActiveSpaceId(id)}
					onCreateSpace={() => setCreateSpaceOpen(true)}
					onUpdateSpace={({ name, description }) => {
						setRealms((prev) =>
							prev.map((r) =>
								r.id === activeRealm.id
									? {
											...r,
											spaces: r.spaces.map((s) =>
												s.id === activeSpace.id ? { ...s, name, description } : s
											),
										}
									: r
							)
						)
						showToast('Space updated')
					}}
					onSavePersona={async (nextPersona) => {
						if (session?.access_token && isLiveId(activeSpace.id)) {
							const payload = {
								tag: nextPersona.tag || undefined,
								display_name: nextPersona.title || undefined,
								is_anonymous: nextPersona.is_anonymous,
							}
							try {
								await updateSpaceIdentity(activeSpace.id, payload)
							} catch (err) {
								if (err instanceof ApiError && err.status === 404) {
									await joinSpace(activeSpace.id)
									await updateSpaceIdentity(activeSpace.id, payload)
								} else {
									throw err
								}
							}
						}
						setPersonasBySpace((prev) => ({
							...prev,
							[activeSpace.id]: nextPersona,
						}))
					}}
					onClose={() => setSpaceDrawerOpen(false)}
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

			{settingsOpen && <SettingsSheet viewMode={viewMode} onClose={() => setSettingsOpen(false)} />}

			{lightboxImage && (
				<ImageLightbox
					url={lightboxImage.url}
					filename={lightboxImage.filename}
					onClose={() => setLightboxImage(null)}
				/>
			)}
		</div>
	)
}
