import { useEffect, useRef, useState } from 'react'
import {
	ApiError,
	addReaction,
	createComment,
	createPost,
	createRealm,
	createSpace,
	echoPost,
	fetchFiles,
	fetchMedia,
	fetchMessages,
	fetchPosts,
	fetchRealms,
	fetchSpaces,
	joinSpace,
	removeReaction,
	sendMessage,
	updateSpaceIdentity,
	type ApiFileAsset,
	type ApiMessage,
	type ApiPost,
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
import { INITIAL_FILES, INITIAL_MESSAGES, INITIAL_POSTS, INITIAL_REALMS } from '../../lib/demo'
import { ConcordSocket, type SocketConnectionState } from '../../lib/socket'
import { isUuid, safeMediaUrl } from '../../lib/url'
import type { ChatMessage, FileAsset, Realm, RealmNote, RoomViewMode, SeriesPost, Space } from '../../lib/types'
import { AttachmentTray } from '../components/AttachmentTray'
import {
	CreateRealmModal,
	CreateSpaceModal,
	PublishPostModal,
	SpacePersonaModal,
} from '../components/CreateModals'
import { LeftRealmsPanel } from '../components/LeftRealmsPanel'
import { RealmNoteBar } from '../components/RealmNoteBar'
import { RealmNoteModal } from '../components/RealmNoteModal'
import { RealmOverviewModal } from '../components/RealmOverviewModal'
import { RightSpacePanel } from '../components/RightSpacePanel'
import { SpaceOrbBar } from '../components/SpaceOrbBar'

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

function mapApiPost(p: ApiPost, index: number): SeriesPost {
	return {
		id: p.id,
		spaceId: p.space_id,
		title: p.title,
		excerpt: p.excerpt || p.body.replace(/[#>*`]/g, '').slice(0, 140),
		body: p.body,
		authorName: p.author?.display_name || p.author?.username || p.author_name || p.author_handle || 'Author',
		authorHandle: p.author?.username || p.author_handle || 'author',
		issueNumber: index + 1,
		echoCount: p.echo_count ?? 0,
		commentCount: p.comment_count ?? 0,
		publishedAt: formatTime(p.published_at ?? p.inserted_at ?? p.created_at),
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

export default function ConcordAppPage() {
	const [session, setSession] = useState<ConcordSession | null>(null)
	const [viewMode, setViewMode] = useState<RoomViewMode>('grid-titled')
	const [realms, setRealms] = useState<Realm[]>(INITIAL_REALMS)
	const [activeRealmId, setActiveRealmId] = useState(INITIAL_REALMS[0].id)
	const [activeSpaceId, setActiveSpaceId] = useState(INITIAL_REALMS[0].spaces[0].id)

	const [messagesBySpace, setMessagesBySpace] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES)
	const [filesBySpace, setFilesBySpace] = useState<Record<string, FileAsset[]>>(INITIAL_FILES)
	const [postsBySpace, setPostsBySpace] = useState<Record<string, SeriesPost[]>>(INITIAL_POSTS)
	const [personasBySpace, setPersonasBySpace] = useState<
		Record<string, { tag?: string; display_name?: string; is_anonymous: boolean }>
	>({})

	const [draft, setDraft] = useState('')
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
	const [orbBarExpanded, setOrbBarExpanded] = useState(false) // Collapsible by default
	const [attachmentOpen, setAttachmentOpen] = useState(false)
	const [realmOverviewOpen, setRealmOverviewOpen] = useState(false)

	// Action modals
	const [createRealmOpen, setCreateRealmOpen] = useState(false)
	const [createSpaceOpen, setCreateSpaceOpen] = useState(false)
	const [publishPostOpen, setPublishPostOpen] = useState(false)
	const [personaModalOpen, setPersonaModalOpen] = useState(false)
	const [noteModalOpen, setNoteModalOpen] = useState(false)

	// Long-press / hover message action menu
	const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null)
	const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)

	// Realtime socket state
	const socketRef = useRef<ConcordSocket | null>(null)
	const [socketState, setSocketState] = useState<SocketConnectionState>('disconnected')

	// Mobile 3-panel spatial state: 'left' (Realms) | 'center' (Active Space) | 'right' (Space Mega-Hub)
	const [mobilePane, setMobilePane] = useState<'left' | 'center' | 'right'>('center')
	const touchStartRef = useRef<{ x: number; y: number } | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const activeRealm = realms.find((r) => r.id === activeRealmId) || realms[0]
	const activeSpace = activeRealm.spaces.find((s) => s.id === activeSpaceId) || activeRealm.spaces[0]
	const messages = messagesBySpace[activeSpace.id] || []
	const spaceFiles = filesBySpace[activeSpace.id] || []
	const spacePosts = postsBySpace[activeSpace.id] || []
	const activePersona = personasBySpace[activeSpace.id]

	// 1. Load session, saved view mode, and Tauri deep-link listener
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

	// 2. Hydrate Realms & Spaces from live Concord Gateway when signed in
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
				// Keep demo realms seamlessly if offline or empty
			}
		})()

		return () => {
			cancelled = true
		}
	}, [session?.access_token])

	// 3. Hydrate active Space messages, posts, and files when live
	useEffect(() => {
		if (!session?.access_token || !isLiveId(activeSpace.id)) return
		let cancelled = false

		;(async () => {
			try {
				const [apiMsgs, apiPosts, apiFiles, apiMedia] = await Promise.all([
					fetchMessages(activeSpace.id).catch(() => []),
					fetchPosts(activeSpace.id).catch(() => []),
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
				if (apiPosts.length > 0) {
					setPostsBySpace((prev) => ({
						...prev,
						[activeSpace.id]: apiPosts.map((p, i) => mapApiPost(p, i)),
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

	// 4. Manage ConcordSocket lifecycle when signed in
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

	// 5. Join active Space channel for realtime events
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
			} else if (event === 'post_published' && payload?.id) {
				setPostsBySpace((prev) => {
					const existing = prev[activeSpace.id] || []
					if (existing.some((p) => p.id === payload.id)) return prev
					const mapped = mapApiPost(payload as ApiPost, existing.length)
					return { ...prev, [activeSpace.id]: [mapped, ...existing] }
				})
			} else if (event === 'post_echoed' && (payload?.original_post_id || payload?.post_id)) {
				const targetPostId = payload.original_post_id || payload.post_id
				setPostsBySpace((prev) => ({
					...prev,
					[activeSpace.id]: (prev[activeSpace.id] || []).map((p) =>
						p.id === targetPostId ? { ...p, echoCount: p.echoCount + 1 } : p
					),
				}))
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

	// Reset per-Space transient UI when switching Spaces
	useEffect(() => {
		setActiveActionMsgId(null)
		setReplyTo(null)
		setAttachmentOpen(false)
	}, [activeSpace.id])

	// Clear long-press timer on unmount
	useEffect(() => {
		return () => {
			if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
		}
	}, [])

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

	const handleSendMessage = async (e?: React.FormEvent) => {
		e?.preventDefault()
		const text = draft.trim()
		if (!text) return

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
				if (wasReacted) {
					await removeReaction(msgId, emoji)
				} else {
					await addReaction(msgId, emoji)
				}
			} catch {
				// Optimistic reaction kept
			}
		}
	}

	const handleCopyMessage = async (msg: ChatMessage) => {
		if (!msg.content) return
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
		setRealms((prev) =>
			prev.map((r) => (r.id === activeRealm.id ? { ...r, note } : r))
		)
		setNoteModalOpen(false)
	}

	// Long-press touch handlers for mobile message actions
	const onMessageTouchStart = (msgId: string, e: React.TouchEvent) => {
		const t = e.touches[0]
		longPressOriginRef.current = { x: t.clientX, y: t.clientY }
		if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
		longPressTimerRef.current = setTimeout(() => {
			setActiveActionMsgId(msgId)
		}, 450)
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

	const onMessageTouchEnd = () => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current)
			longPressTimerRef.current = null
		}
		longPressOriginRef.current = null
	}

	// Horizontal touch swipe between [Left: Realms] <-> [Center: Space] <-> [Right: Space Hub]
	const onTouchStart = (e: React.TouchEvent) => {
		const t = e.touches[0]
		touchStartRef.current = { x: t.clientX, y: t.clientY }
	}

	const onTouchEnd = (e: React.TouchEvent) => {
		if (!touchStartRef.current) return
		const t = e.changedTouches[0]
		const dx = t.clientX - touchStartRef.current.x
		const dy = t.clientY - touchStartRef.current.y
		touchStartRef.current = null

		if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return

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
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			className="h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 flex relative"
		>
			{/* LEFT PANEL: Visual Realms Grid (Desktop fixed column; Mobile partial-reveal drawer) */}
			<div
				className={`fixed inset-y-0 left-0 z-30 w-[82vw] max-w-[300px] lg:static lg:w-[272px] lg:translate-x-0 transition-transform duration-300 ease-out ${
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
						setPostsBySpace(INITIAL_POSTS)
						setPersonasBySpace({})
					}}
				/>
			</div>

			{/* Mobile Backdrop when Left Drawer is partially revealed */}
			{mobilePane === 'left' && (
				<button
					type="button"
					aria-label="Close realms drawer"
					onClick={() => setMobilePane('center')}
					className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px] lg:hidden"
				/>
			)}

			{/* CENTER STAGE: Active Space Conversation */}
			<main className="flex-1 min-w-0 h-full flex flex-col bg-[#09090b]">
				{/* Minimal Top Bar */}
				<header className="px-4 h-14 border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0 bg-[#09090b]/90 backdrop-blur-md">
					<div className="flex items-center gap-3 min-w-0">
						<button
							type="button"
							onClick={() => setMobilePane('left')}
							className="lg:hidden p-1.5 -ml-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
							aria-label="Open Realms"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
								className="w-8 h-8 rounded-xl object-cover border border-white/10 group-hover:border-[#8b5cf6]/60 transition shrink-0"
							/>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="text-sm font-bold text-white truncate group-hover:text-[#c4b5fd] transition">
										{activeSpace.name}
									</span>
									<span className="text-xs text-zinc-600">/</span>
									<span className="text-xs text-zinc-400 truncate">{activeRealm.name}</span>
									{socketState === 'connected' && (
										<span
											title="Realtime connected"
											className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
										/>
									)}
								</div>
								{activeSpace.description && (
									<p className="text-[11px] text-zinc-500 truncate">{activeSpace.description}</p>
								)}
							</div>
						</button>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<button
							type="button"
							onClick={() => setPersonaModalOpen(true)}
							title="Contextual Space Persona"
							className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] font-medium text-zinc-300 hover:text-white transition cursor-pointer"
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
							className="lg:hidden px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
						>
							Hub
						</button>
					</div>
				</header>

				{/* Curator's Realm Note Bar */}
				<RealmNoteBar
					note={activeRealm.note}
					onEditNote={() => setNoteModalOpen(true)}
				/>

				{/* Conversation Stream (Telegram/iMessage Clean Typography-First Flow) */}
				<div
					onClick={() => activeActionMsgId && setActiveActionMsgId(null)}
					className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4"
				>
					<div className="max-w-2xl mx-auto space-y-4">
						{messages.length === 0 ? (
							<div className="text-center py-20 space-y-2">
								<div className="text-base font-editorial italic text-zinc-400">
									“{activeSpace.name}” is quiet.
								</div>
								<p className="text-xs text-zinc-600">Write the first line below.</p>
							</div>
						) : (
							messages.map((msg) => {
								const actionsOpen = activeActionMsgId === msg.id
								return (
									<div
										key={msg.id}
										onDoubleClick={() => setReplyTo(msg)}
										onTouchStart={(e) => onMessageTouchStart(msg.id, e)}
										onTouchMove={onMessageTouchMove}
										onTouchEnd={onMessageTouchEnd}
										onTouchCancel={onMessageTouchEnd}
										className={`group relative flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
									>
										{!msg.isSelf && (
											<div className="flex items-center gap-2 mb-1 px-1">
												<span className="text-xs font-semibold text-zinc-300">{msg.authorName}</span>
												<span className="text-[10px] text-zinc-600">{msg.createdAt}</span>
											</div>
										)}

										{/* Hover (desktop) & Long-Press (mobile) Quick Action Bar */}
										<div
											onClick={(e) => e.stopPropagation()}
											className={`mb-1 flex items-center gap-1 px-1.5 py-1 rounded-full bg-[#15151b]/95 border border-white/10 shadow-lg backdrop-blur-md transition-opacity ${
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
													className="w-6 h-6 rounded-full hover:bg-white/10 text-xs flex items-center justify-center transition cursor-pointer"
													title={`React with ${emoji}`}
												>
													{emoji}
												</button>
											))}
											<span className="w-px h-3.5 bg-white/10 mx-0.5" />
											<button
												type="button"
												onClick={() => {
													setReplyTo(msg)
													setActiveActionMsgId(null)
												}}
												className="px-2 py-0.5 rounded-full hover:bg-white/10 text-[11px] font-medium text-zinc-300 hover:text-white transition cursor-pointer"
											>
												Reply
											</button>
											{msg.content && (
												<button
													type="button"
													onClick={() => handleCopyMessage(msg)}
													className="px-2 py-0.5 rounded-full hover:bg-white/10 text-[11px] font-medium text-zinc-300 hover:text-white transition cursor-pointer"
												>
													{copiedMsgId === msg.id ? 'Copied' : 'Copy'}
												</button>
											)}
										</div>

										<div
											className={`max-w-[85%] md:max-w-[78%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed transition ${
												msg.isSelf
													? 'bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 text-zinc-100 rounded-br-md'
													: 'bg-[#141418] border border-white/[0.07] text-zinc-200 rounded-bl-md'
											}`}
										>
											{msg.replyTo && (
												<div className="mb-2 pl-2.5 border-l-2 border-[#8b5cf6]/60 text-xs text-zinc-400">
													<span className="font-semibold text-zinc-300">{msg.replyTo.authorName}: </span>
													<span className="italic">{msg.replyTo.excerpt}</span>
												</div>
											)}

											{msg.attachment && msg.attachment.kind === 'image' && safeMediaUrl(msg.attachment.url) && (
												<img
													src={safeMediaUrl(msg.attachment.url) ?? undefined}
													alt={msg.attachment.filename}
													className="rounded-xl max-h-64 object-cover mb-2 border border-white/10"
												/>
											)}

											{msg.attachment && msg.attachment.kind === 'video' && safeMediaUrl(msg.attachment.url) && (
												<video
													src={safeMediaUrl(msg.attachment.url) ?? undefined}
													controls
													playsInline
													className="rounded-xl max-h-64 w-full mb-2 border border-white/10 bg-black"
												/>
											)}

											{msg.attachment && msg.attachment.kind === 'audio' && safeMediaUrl(msg.attachment.url) && (
												<div className="mb-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2 space-y-1.5">
													<div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
														<span className="truncate font-medium text-zinc-200">
															{msg.attachment.filename}
														</span>
														<span className="text-[10px] text-[#a78bfa] shrink-0">Voice</span>
													</div>
													<audio
														src={safeMediaUrl(msg.attachment.url) ?? undefined}
														controls
														preload="metadata"
														className="w-full h-8"
													/>
												</div>
											)}

											{msg.attachment && msg.attachment.kind === 'doc' && (
												<div className="mb-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-zinc-300 flex items-center justify-between gap-3">
													<span className="font-mono truncate">{msg.attachment.filename}</span>
													<span className="text-[10px] text-[#a78bfa] shrink-0">Doc</span>
												</div>
											)}

											{msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

											{msg.isSelf && (
												<div className="text-[10px] text-zinc-500 text-right mt-1">{msg.createdAt}</div>
											)}
										</div>

										{msg.reactions && msg.reactions.length > 0 && (
											<div className="flex gap-1 mt-1 px-1">
												{msg.reactions.map((r) => (
													<button
														key={r.emoji}
														type="button"
														onClick={() => handleToggleReaction(msg.id, r.emoji)}
														className={`text-[11px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
															r.reacted
																? 'bg-[#8b5cf6]/25 border-[#8b5cf6]/50 text-white'
																: 'bg-white/[0.05] border-white/[0.08] text-zinc-300 hover:border-white/20'
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

				{/* Collapsible Space Orb Bar (Gentle Arc on Mobile, Straight Row on Desktop) */}
				<SpaceOrbBar
					spaces={activeRealm.spaces}
					activeSpaceId={activeSpace.id}
					expanded={orbBarExpanded}
					onToggleExpanded={() => setOrbBarExpanded((v) => !v)}
					onSelectSpace={(id) => setActiveSpaceId(id)}
				/>

				{/* Reply Banner */}
				{replyTo && (
					<div className="px-4 py-1.5 bg-[#121216] border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
						<div className="truncate">
							Replying to <span className="text-zinc-200 font-semibold">{replyTo.authorName}</span>: {replyTo.content}
						</div>
						<button
							type="button"
							aria-label="Cancel reply"
							onClick={() => setReplyTo(null)}
							className="text-zinc-500 hover:text-zinc-200 ml-3 p-1 rounded-md hover:bg-white/[0.06] cursor-pointer"
						>
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
								<path d="M18 6L6 18" />
								<path d="M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}

				{/* Message Composer */}
				<form
					onSubmit={handleSendMessage}
					className="px-4 py-3 border-t border-white/[0.06] bg-[#0b0b0e] shrink-0"
				>
					<div className="max-w-2xl mx-auto flex items-center gap-2">
						<button
							type="button"
							title="Attach media, docs, voice, or stickers"
							onClick={() => setAttachmentOpen((v) => !v)}
							className={`p-2.5 rounded-xl border transition cursor-pointer ${
								attachmentOpen
									? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 text-[#c4b5fd]'
									: 'bg-white/[0.04] border-white/[0.07] text-zinc-400 hover:text-white'
							}`}
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</button>

						<input
							type="text"
							value={draft}
							onFocus={() => setOrbBarExpanded(false)}
							onChange={(e) => setDraft(e.target.value)}
							placeholder={`Write in ${activeSpace.name}…`}
							className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/25 transition"
						/>

						<button
							type="submit"
							disabled={!draft.trim()}
							className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-35 text-xs font-bold transition cursor-pointer"
						>
							Send
						</button>
					</div>
				</form>

				{/* In-App Bottom Attachment Tray (Replaces keyboard area) */}
				{attachmentOpen && (
					<AttachmentTray
						spaceId={activeSpace.id}
						onClose={() => setAttachmentOpen(false)}
						onSendAsset={handleSendAsset}
						onSendSticker={(sticker) => {
							setDraft((d) => (d ? `${d} ${sticker}` : sticker))
						}}
					/>
				)}
			</main>

			{/* RIGHT PANEL: TikTok-style Space Mega-Hub (Desktop column; Mobile full-height swipe-in) */}
			<div
				className={`fixed inset-y-0 right-0 z-30 w-[88vw] max-w-[340px] lg:static lg:w-[316px] lg:translate-x-0 transition-transform duration-300 ease-out ${
					mobilePane === 'right' ? 'translate-x-0 shadow-2xl shadow-black' : 'translate-x-full'
				}`}
			>
				<RightSpacePanel
					space={activeSpace}
					posts={spacePosts}
					files={spaceFiles}
					onCloseMobile={() => setMobilePane('center')}
					onPublishPost={() => setPublishPostOpen(true)}
					onEchoPost={(postId) => {
						setPostsBySpace((prev) => ({
							...prev,
							[activeSpace.id]: (prev[activeSpace.id] || []).map((p) =>
								p.id === postId ? { ...p, echoCount: p.echoCount + 1 } : p
							),
						}))
						if (session?.access_token && isLiveId(postId)) {
							echoPost(postId, activeSpace.id).catch(() => {})
						}
					}}
					onAddComment={(postId, content) => {
						setPostsBySpace((prev) => ({
							...prev,
							[activeSpace.id]: (prev[activeSpace.id] || []).map((p) =>
								p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
							),
						}))
						if (session?.access_token && isLiveId(postId)) {
							createComment(postId, content).catch(() => {})
						}
					}}
				/>
			</div>

			{/* REALM OVERVIEW & STATS SHEET (Opened by tapping the Top Bar) */}
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

			{/* PUBLISH SERIES POST MODAL */}
			{publishPostOpen && (
				<PublishPostModal
					spaceId={activeSpace.id}
					spaceName={activeSpace.name}
					onClose={() => setPublishPostOpen(false)}
					onSubmit={async (params) => {
						if (session?.access_token && isLiveId(activeSpace.id)) {
							const created = await createPost(activeSpace.id, params)
							const mapped = mapApiPost(created, spacePosts.length)
							setPostsBySpace((prev) => {
								const existing = prev[activeSpace.id] || []
								if (existing.some((p) => p.id === mapped.id)) return prev
								return { ...prev, [activeSpace.id]: [mapped, ...existing] }
							})
							return created
						}
						const newPost: SeriesPost = {
							id: `post-${Date.now()}`,
							spaceId: activeSpace.id,
							title: params.title,
							excerpt: params.body.replace(/[#>*`]/g, '').slice(0, 140),
							body: params.body,
							authorName: activePersona?.display_name || session?.user.display_name || 'You',
							authorHandle: activePersona?.tag || session?.user.username || 'galediç',
							issueNumber: spacePosts.length + 1,
							echoCount: 0,
							commentCount: 0,
							publishedAt: 'Just now',
						}
						setPostsBySpace((prev) => ({
							...prev,
							[activeSpace.id]: [newPost, ...(prev[activeSpace.id] || [])],
						}))
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
