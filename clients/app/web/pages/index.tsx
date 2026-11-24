import { useEffect, useRef, useState } from 'react'
import {
	clearSession,
	getSession,
	listenForTauriDeepLink,
	startSignIn,
	type ConcordSession,
} from '../../lib/auth'
import { INITIAL_FILES, INITIAL_MESSAGES, INITIAL_POSTS, INITIAL_REALMS } from '../../lib/demo'
import type { ChatMessage, FileAsset, RoomViewMode } from '../../lib/types'
import { AttachmentTray } from '../components/AttachmentTray'
import { LeftRealmsPanel } from '../components/LeftRealmsPanel'
import { RealmNoteBar } from '../components/RealmNoteBar'
import { RealmOverviewModal } from '../components/RealmOverviewModal'
import { RightSpacePanel } from '../components/RightSpacePanel'
import { SpaceOrbBar } from '../components/SpaceOrbBar'

export const metadata = { title: 'Concord' }

const VIEW_MODE_KEY = 'concord_rooms_view_mode'

export default function ConcordAppPage() {
	const [session, setSession] = useState<ConcordSession | null>(null)
	const [viewMode, setViewMode] = useState<RoomViewMode>('grid-titled')
	const [realms] = useState(INITIAL_REALMS)
	const [activeRealmId, setActiveRealmId] = useState(INITIAL_REALMS[0].id)
	const [activeSpaceId, setActiveSpaceId] = useState(INITIAL_REALMS[0].spaces[0].id)

	const [messagesBySpace, setMessagesBySpace] = useState(INITIAL_MESSAGES)
	const [filesBySpace, setFilesBySpace] = useState(INITIAL_FILES)
	const [postsBySpace] = useState(INITIAL_POSTS)

	const [draft, setDraft] = useState('')
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
	const [orbBarExpanded, setOrbBarExpanded] = useState(false) // Collapsible by default
	const [attachmentOpen, setAttachmentOpen] = useState(false)
	const [realmOverviewOpen, setRealmOverviewOpen] = useState(false)

	// Mobile 3-panel spatial state: 'left' (Realms) | 'center' (Active Space) | 'right' (Space Mega-Hub)
	const [mobilePane, setMobilePane] = useState<'left' | 'center' | 'right'>('center')
	const touchStartRef = useRef<{ x: number; y: number } | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const activeRealm = realms.find((r) => r.id === activeRealmId) || realms[0]
	const activeSpace = activeRealm.spaces.find((s) => s.id === activeSpaceId) || activeRealm.spaces[0]
	const messages = messagesBySpace[activeSpace.id] || []
	const spaceFiles = filesBySpace[activeSpace.id] || []
	const spacePosts = postsBySpace[activeSpace.id] || []

	useEffect(() => {
		setSession(getSession())
		const savedMode = localStorage.getItem(VIEW_MODE_KEY) as RoomViewMode | null
		if (savedMode === 'grid-titled' || savedMode === 'grid-visual' || savedMode === 'list') {
			setViewMode(savedMode)
		}

		let unlisten: (() => void) | undefined
		listenForTauriDeepLink((s) => setSession(s)).then((fn) => {
			unlisten = fn
		})
		return () => {
			unlisten?.()
		}
	}, [])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages.length, activeSpace.id])

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

	const handleSendMessage = (e?: React.FormEvent) => {
		e?.preventDefault()
		const text = draft.trim()
		if (!text) return

		const newMsg: ChatMessage = {
			id: `msg-${Date.now()}`,
			spaceId: activeSpace.id,
			authorId: session?.user.id || 'self',
			authorName: session?.user.display_name || 'You',
			authorHandle: session?.user.username || 'galediç',
			authorAvatar: session?.user.avatar_url,
			isSelf: true,
			content: text,
			replyTo: replyTo
				? {
						id: replyTo.id,
						authorName: replyTo.authorName,
						excerpt: replyTo.content.slice(0, 64),
					}
				: undefined,
			createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		}

		setMessagesBySpace((prev) => ({
			...prev,
			[activeSpace.id]: [...(prev[activeSpace.id] || []), newMsg],
		}))
		setDraft('')
		setReplyTo(null)
	}

	const handleSendAsset = (asset: FileAsset, caption?: string) => {
		setFilesBySpace((prev) => ({
			...prev,
			[activeSpace.id]: [asset, ...(prev[activeSpace.id] || [])],
		}))

		const newMsg: ChatMessage = {
			id: `msg-${Date.now()}`,
			spaceId: activeSpace.id,
			authorId: session?.user.id || 'self',
			authorName: session?.user.display_name || 'You',
			authorHandle: session?.user.username || 'galediç',
			isSelf: true,
			content: caption || (asset.kind === 'image' ? '' : `Shared ${asset.filename}`),
			attachment: asset,
			createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		}

		setMessagesBySpace((prev) => ({
			...prev,
			[activeSpace.id]: [...(prev[activeSpace.id] || []), newMsg],
		}))
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
			// Swiped right
			if (mobilePane === 'right') setMobilePane('center')
			else if (mobilePane === 'center') setMobilePane('left')
		} else {
			// Swiped left (TikTok-style right panel reveal)
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
					session={session}
					onSignIn={() => startSignIn()}
					onSignOut={() => {
						clearSession()
						setSession(null)
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
								</div>
								{activeSpace.description && (
									<p className="text-[11px] text-zinc-500 truncate">{activeSpace.description}</p>
								)}
							</div>
						</button>
					</div>

					<button
						type="button"
						onClick={() => setMobilePane((p) => (p === 'right' ? 'center' : 'right'))}
						className="lg:hidden px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
					>
						Hub
					</button>
				</header>

				{/* Curator's Realm Note Bar */}
				<RealmNoteBar note={activeRealm.note} />

				{/* Conversation Stream (Telegram/iMessage Clean Typography-First Flow) */}
				<div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
					<div className="max-w-2xl mx-auto space-y-4">
						{messages.length === 0 ? (
							<div className="text-center py-20 space-y-2">
								<div className="text-base font-editorial italic text-zinc-400">
									“{activeSpace.name}” is quiet.
								</div>
								<p className="text-xs text-zinc-600">Write the first line below.</p>
							</div>
						) : (
							messages.map((msg) => (
								<div
									key={msg.id}
									onDoubleClick={() => setReplyTo(msg)}
									className={`group flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
								>
									{!msg.isSelf && (
										<div className="flex items-center gap-2 mb-1 px-1">
											<span className="text-xs font-semibold text-zinc-300">{msg.authorName}</span>
											<span className="text-[10px] text-zinc-600">{msg.createdAt}</span>
										</div>
									)}

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

										{msg.attachment && msg.attachment.kind === 'image' && (
											<img
												src={msg.attachment.url}
												alt={msg.attachment.filename}
												className="rounded-xl max-h-64 object-cover mb-2 border border-white/10"
											/>
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
												<span
													key={r.emoji}
													className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300"
												>
													{r.emoji} {r.count}
												</span>
											))}
										</div>
									)}
								</div>
							))
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
							onClick={() => setReplyTo(null)}
							className="text-zinc-500 hover:text-zinc-200 ml-3 cursor-pointer"
						>
							✕
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
							title="Attach media, docs, or stickers"
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
				/>
			</div>

			{/* REALM OVERVIEW & STATS SHEET (Opened by tapping the Top Bar) */}
			{realmOverviewOpen && (
				<RealmOverviewModal
					realm={activeRealm}
					activeSpaceId={activeSpace.id}
					onSelectSpace={(id) => setActiveSpaceId(id)}
					onClose={() => setRealmOverviewOpen(false)}
				/>
			)}
		</div>
	)
}
