import { useEffect, useRef, useState } from 'react'
import { hapticTap } from '../../lib/haptics'
import { MAX_FREE_SPACES_PER_REALM, type Realm, type Space } from '../../lib/types'

export interface SpacePersonaState {
	title: string
	mood: string
	tag?: string
	is_anonymous: boolean
}

interface SpaceDetailsDrawerProps {
	realm: Realm
	space: Space
	role?: 'curator' | 'member'
	persona: SpacePersonaState
	defaultTitle: string
	onSelectSpace: (spaceId: string) => void
	onCreateSpace?: () => void
	onUpdateSpace?: (updates: { name: string; description: string }) => void
	onSavePersona: (persona: SpacePersonaState) => Promise<void> | void
	onClose: () => void
}

type DrawerTab = 'space' | 'persona'

const MOOD_PRESETS = [
	'Writing quietly',
	'Deep work',
	'Listening to music',
	'Just lurking',
	'Open to chat',
]

export function SpaceDetailsDrawer({
	realm,
	space,
	role = 'curator',
	persona,
	defaultTitle,
	onSelectSpace,
	onCreateSpace,
	onUpdateSpace,
	onSavePersona,
	onClose,
}: SpaceDetailsDrawerProps) {
	const [tab, setTab] = useState<DrawerTab>('space')
	const canEditSpace = role === 'curator'

	const [editingSpace, setEditingSpace] = useState(false)
	const [spaceName, setSpaceName] = useState(space.name)
	const [spaceDesc, setSpaceDesc] = useState(space.description || '')

	const [title, setTitle] = useState(persona.title || defaultTitle)
	const [mood, setMood] = useState(persona.mood || '')
	const [tag, setTag] = useState(persona.tag || '')
	const [isAnonymous, setIsAnonymous] = useState(persona.is_anonymous)
	const [savingPersona, setSavingPersona] = useState(false)
	const [savedFeedback, setSavedFeedback] = useState(false)
	const [personaError, setPersonaError] = useState<string | null>(null)

	// Swipe-down-to-dismiss gesture state
	const scrollRef = useRef<HTMLDivElement>(null)
	const dragStartYRef = useRef<number | null>(null)
	const startedAtTopRef = useRef(false)
	const [dragOffsetY, setDragOffsetY] = useState(0)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	const handleTouchStart = (e: React.TouchEvent, fromHandle = false) => {
		dragStartYRef.current = e.touches[0].clientY
		startedAtTopRef.current = fromHandle || (scrollRef.current?.scrollTop ?? 0) <= 2
	}

	const handleTouchMove = (e: React.TouchEvent) => {
		if (dragStartYRef.current === null || !startedAtTopRef.current) return
		const dy = e.touches[0].clientY - dragStartYRef.current
		if (dy > 0) setDragOffsetY(dy)
	}

	const handleTouchEnd = () => {
		if (dragOffsetY > 90) {
			hapticTap()
			onClose()
		}
		setDragOffsetY(0)
		dragStartYRef.current = null
		startedAtTopRef.current = false
	}

	const memberCount = realm.isDirect ? 2 : 18 + realm.spaces.length * 4
	const onlineCount = realm.isDirect ? 2 : Math.max(3, Math.floor(memberCount * 0.28))
	const wordsThisWeek = realm.isDirect ? 2410 : 8420 + realm.spaces.length * 1060

	const handleSaveSpaceDetails = (e: React.FormEvent) => {
		e.preventDefault()
		const cleanName = spaceName.trim()
		if (!cleanName) return
		hapticTap()
		onUpdateSpace?.({ name: cleanName, description: spaceDesc.trim() })
		setEditingSpace(false)
	}

	const handlePersonaSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setSavingPersona(true)
		setPersonaError(null)
		try {
			await onSavePersona({
				title: title.trim() || defaultTitle,
				mood: mood.trim(),
				tag: tag.trim().replace(/^@+/, ''),
				is_anonymous: isAnonymous,
			})
			hapticTap()
			setSavedFeedback(true)
			setTimeout(() => setSavedFeedback(false), 1800)
		} catch (err) {
			setPersonaError(err instanceof Error ? err.message : 'Could not save persona')
		} finally {
			setSavingPersona(false)
		}
	}

	return (
		<div
			data-no-pane-swipe="true"
			onClick={onClose}
			className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
				}}
				className={`relative w-full max-w-lg h-[84dvh] rounded-t-3xl bg-[#08100d] shadow-[0_-18px_48px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden ${
					dragOffsetY > 0 ? '' : 'transition-transform duration-200 ease-out'
				}`}
			>
				{/* Swipe-down Drag Handle (no X button — swipe down or tap outside) */}
				<div
					onTouchStart={(e) => handleTouchStart(e, true)}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					className="pt-3 pb-2 flex justify-center shrink-0 cursor-grab active:cursor-grabbing"
				>
					<span className="w-11 h-1.5 rounded-full bg-[#e5ebcd]/20" />
				</div>

				{/* Scrollable Content */}
				<div
					ref={scrollRef}
					onTouchStart={(e) => handleTouchStart(e, false)}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					className="flex-1 overflow-y-auto no-scrollbar pb-24"
				>
					{tab === 'space' ? (
						<div>
							{/* Space Backdrop Hero + Centered Orb */}
							<div className="relative h-40 w-full overflow-hidden">
								<img
									src={realm.coverUrl}
									alt={realm.name}
									className="w-full h-full object-cover opacity-65"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-[#08100d] via-[#08100d]/55 to-transparent" />

								<span className="absolute top-3 left-5 text-[12px] font-medium text-[#9e998c]">
									{role === 'curator' ? 'Curator' : 'Member'}
								</span>

								{/* Centered Space Orb + Name */}
								<div className="absolute bottom-3 inset-x-5 flex flex-col items-center text-center">
									<div
										className={`w-16 h-16 rounded-full bg-gradient-to-br ${space.orbGradient} ring-4 ring-[#08100d] flex items-center justify-center text-[20px] font-bold text-[#edf3d2] shadow-xl`}
									>
										{space.name[0]}
									</div>
									<h2 className="mt-2 text-[22px] font-bold text-[#edf3d2] tracking-tight">{space.name}</h2>
									<p className="text-[13px] text-[#9e998c]">{realm.name}</p>
								</div>
							</div>

							<div className="px-5 pt-4 space-y-5">
								{/* Space Description / Role-Based Edit */}
								{editingSpace && canEditSpace ? (
									<form onSubmit={handleSaveSpaceDetails} className="rounded-2xl bg-[#0f1f19] p-4 space-y-3">
										<div className="space-y-1.5">
											<label className="text-[13px] font-semibold text-[#e5ebcd]">Space Name</label>
											<input
												type="text"
												value={spaceName}
												onChange={(e) => setSpaceName(e.target.value)}
												maxLength={48}
												className="w-full rounded-xl bg-[#050a08] px-3.5 py-2.5 text-[15px] text-[#edf3d2] focus:outline-none"
											/>
										</div>
										<div className="space-y-1.5">
											<label className="text-[13px] font-semibold text-[#e5ebcd]">Description</label>
											<textarea
												value={spaceDesc}
												onChange={(e) => setSpaceDesc(e.target.value)}
												rows={2}
												maxLength={180}
												className="w-full rounded-xl bg-[#050a08] px-3.5 py-2.5 text-[15px] text-[#edf3d2] resize-none focus:outline-none"
											/>
										</div>
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setEditingSpace(false)}
												className="px-4 py-2 rounded-xl bg-[#152a22] text-[13px] font-semibold text-[#e5ebcd] cursor-pointer"
											>
												Cancel
											</button>
											<button
												type="submit"
												className="px-4 py-2 rounded-xl bg-[#cedb9c] text-[#050a08] text-[13px] font-bold cursor-pointer"
											>
												Save
											</button>
										</div>
									</form>
								) : (
									<div className="rounded-2xl bg-[#0f1f19] p-4 flex items-start justify-between gap-3">
										<p className="text-[14px] text-[#e5ebcd]/90 leading-relaxed">
											{space.description || realm.description || 'A quiet Space for conversation and shared files.'}
										</p>
										{canEditSpace && (
											<button
												type="button"
												onClick={() => setEditingSpace(true)}
												className="px-3 py-1.5 rounded-xl bg-[#152a22] hover:bg-[#1c382d] text-[13px] font-semibold text-[#edf3d2] shrink-0 cursor-pointer transition"
											>
												Edit
											</button>
										)}
									</div>
								)}

								{/* Core Stats */}
								<div className="grid grid-cols-3 gap-2.5">
									<div className="rounded-2xl bg-[#0f1f19] p-3.5 text-center">
										<div className="text-[20px] font-bold text-[#edf3d2]">
											{realm.spaces.length}
											<span className="text-[13px] font-normal text-[#9e998c]">/{MAX_FREE_SPACES_PER_REALM}</span>
										</div>
										<div className="text-[12px] text-[#9e998c] mt-0.5">Spaces</div>
									</div>
									<div className="rounded-2xl bg-[#0f1f19] p-3.5 text-center">
										<div className="text-[20px] font-bold text-[#edf3d2]">{memberCount}</div>
										<div className="text-[12px] text-[#9e998c] mt-0.5">People</div>
									</div>
									<div className="rounded-2xl bg-[#0f1f19] p-3.5 text-center">
										<div className="text-[20px] font-bold text-[#cedb9c] flex items-center justify-center gap-1.5">
											<span className="w-2 h-2 rounded-full bg-[#cedb9c]" />
											{onlineCount}
										</div>
										<div className="text-[12px] text-[#9e998c] mt-0.5">Online</div>
									</div>
								</div>

								{/* Activity Pulse */}
								<div className="rounded-2xl bg-[#0f1f19] p-4 space-y-3">
									<div className="text-[14px] font-semibold text-[#e5ebcd]">Space Pulse</div>
									<div className="grid grid-cols-2 gap-3 text-[14px]">
										<div>
											<div className="text-[12px] text-[#9e998c]">Words this week</div>
											<div className="font-semibold text-[#edf3d2] mt-0.5">
												{wordsThisWeek.toLocaleString()} words
											</div>
										</div>
										<div>
											<div className="text-[12px] text-[#9e998c]">Peak hour</div>
											<div className="font-semibold text-[#edf3d2] mt-0.5">11:00 PM</div>
										</div>
									</div>
								</div>

								{/* All Spaces in Realm */}
								<div className="space-y-2.5">
									<div className="flex items-center justify-between">
										<div className="text-[14px] font-semibold text-[#e5ebcd]">
											Spaces in {realm.name}
										</div>
										{onCreateSpace && (
											<button
												type="button"
												onClick={() => {
													onClose()
													onCreateSpace()
												}}
												className="px-3 py-1.5 rounded-xl bg-[#0f1f19] hover:bg-[#152a22] text-[13px] font-semibold text-[#cedb9c] cursor-pointer transition"
											>
												+ New Space
											</button>
										)}
									</div>
									<div className="grid grid-cols-2 gap-2">
										{realm.spaces.map((sp) => {
											const active = sp.id === space.id
											return (
												<button
													key={sp.id}
													type="button"
													onClick={() => {
														hapticTap()
														onSelectSpace(sp.id)
														onClose()
													}}
													className={`flex items-center gap-2.5 p-3 rounded-2xl text-left transition cursor-pointer ${
														active
															? 'bg-[#152a22] text-[#edf3d2]'
															: 'bg-[#0f1f19] hover:bg-[#152a22] text-[#e5ebcd]/85'
													}`}
												>
													<div
														className={`w-8 h-8 rounded-full bg-gradient-to-br ${sp.orbGradient} shrink-0 flex items-center justify-center text-[12px] font-bold text-[#edf3d2]`}
													>
														{sp.name[0]}
													</div>
													<div className="min-w-0">
														<div className="text-[14px] font-semibold truncate">{sp.name}</div>
													</div>
												</button>
											)
										})}
									</div>
								</div>
							</div>
						</div>
					) : (
						/* Tab 2: Realm/Space Persona (Title + Mood + Tag + Anonymous) */
						<form onSubmit={handlePersonaSubmit} className="px-5 pt-2 pb-5 space-y-5">
							<div>
								<h2 className="text-[20px] font-bold text-[#edf3d2]">Your Persona</h2>
								<p className="text-[13px] text-[#9e998c]">
									How you appear in {realm.name} / {space.name}
								</p>
							</div>

							{/* Live Preview Card */}
							<div className="rounded-2xl bg-[#0f1f19] p-4 flex items-center gap-3.5">
								<div className="w-12 h-12 rounded-full bg-[#cedb9c] flex items-center justify-center text-[17px] font-bold text-[#050a08] shrink-0">
									{isAnonymous ? '?' : (title || defaultTitle)[0]?.toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-[16px] font-bold text-[#edf3d2] truncate">
											{isAnonymous ? 'Anonymous' : title || defaultTitle}
										</span>
										{tag && !isAnonymous && (
											<span className="text-[13px] text-[#cedb9c] truncate">@{tag.replace(/^@+/, '')}</span>
										)}
									</div>
									<p className="text-[13px] text-[#9e998c] truncate mt-0.5">
										{mood || 'Set a mood for this Realm…'}
									</p>
								</div>
							</div>

							{/* Title */}
							<div className="space-y-1.5">
								<label htmlFor="persona-title" className="block text-[14px] font-semibold text-[#e5ebcd]">
									Title
								</label>
								<input
									id="persona-title"
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="Your Realm or Space name"
									maxLength={40}
									disabled={isAnonymous}
									className="w-full rounded-2xl bg-[#0f1f19] px-4 py-3 text-[15px] text-[#edf3d2] placeholder:text-[#7a7569] focus:outline-none disabled:opacity-45"
								/>
							</div>

							{/* Mood */}
							<div className="space-y-2">
								<label htmlFor="persona-mood" className="block text-[14px] font-semibold text-[#e5ebcd]">
									Mood
								</label>
								<input
									id="persona-mood"
									type="text"
									value={mood}
									onChange={(e) => setMood(e.target.value)}
									placeholder="What's your current mood or vibe?"
									maxLength={90}
									className="w-full rounded-2xl bg-[#0f1f19] px-4 py-3 text-[15px] text-[#edf3d2] placeholder:text-[#7a7569] focus:outline-none"
								/>
								<div className="flex flex-wrap gap-1.5">
									{MOOD_PRESETS.map((preset) => (
										<button
											key={preset}
											type="button"
											onClick={() => {
												hapticTap()
												setMood(preset)
											}}
											className="px-3 py-1.5 rounded-xl bg-[#0f1f19] hover:bg-[#152a22] text-[12px] font-medium text-[#e5ebcd] cursor-pointer transition"
										>
											{preset}
										</button>
									))}
								</div>
							</div>

							{/* Tag */}
							<div className="space-y-1.5">
								<label htmlFor="persona-handle" className="block text-[14px] font-semibold text-[#e5ebcd]">
									Tag
								</label>
								<input
									id="persona-handle"
									type="text"
									value={tag}
									onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
									placeholder="e.g. nightowl"
									maxLength={28}
									disabled={isAnonymous}
									className="w-full rounded-2xl bg-[#0f1f19] px-4 py-3 text-[15px] text-[#edf3d2] placeholder:text-[#7a7569] focus:outline-none disabled:opacity-45"
								/>
							</div>

							{/* Anonymous Toggle */}
							<label className="flex items-center justify-between rounded-2xl bg-[#0f1f19] px-4 py-3.5 cursor-pointer">
								<div>
									<div className="text-[15px] font-semibold text-[#edf3d2]">Appear Anonymous</div>
									<div className="text-[13px] text-[#9e998c]">Hide your title &amp; tag in this Space</div>
								</div>
								<input
									type="checkbox"
									checked={isAnonymous}
									onChange={(e) => setIsAnonymous(e.target.checked)}
									className="w-5 h-5 accent-[#cedb9c]"
								/>
							</label>

							{personaError && (
								<div className="rounded-xl bg-red-500/15 px-4 py-2.5 text-[13px] text-red-300">
									{personaError}
								</div>
							)}

							<button
								type="submit"
								disabled={savingPersona}
								className="w-full py-3.5 rounded-2xl bg-[#cedb9c] text-[#050a08] hover:bg-[#dce7b0] disabled:opacity-45 text-[15px] font-bold transition cursor-pointer"
							>
								{savingPersona ? 'Saving…' : savedFeedback ? 'Persona Saved' : 'Save Persona'}
							</button>
						</form>
					)}
				</div>

				{/* Floating Bottom Toggle Bar (Space <-> Persona) */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 px-5 bg-gradient-to-t from-[#08100d] via-[#08100d]/95 to-transparent flex justify-center">
					<div className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full bg-[#0f1f19] shadow-2xl shadow-black/80">
						<button
							type="button"
							onClick={() => {
								hapticTap()
								setTab('space')
							}}
							className={`px-5 py-2 rounded-full text-[14px] font-semibold transition cursor-pointer ${
								tab === 'space' ? 'bg-[#cedb9c] text-[#050a08]' : 'text-[#e5ebcd]/80 hover:text-[#edf3d2]'
							}`}
						>
							Space Details
						</button>
						<button
							type="button"
							onClick={() => {
								hapticTap()
								setTab('persona')
							}}
							className={`px-5 py-2 rounded-full text-[14px] font-semibold transition cursor-pointer ${
								tab === 'persona' ? 'bg-[#cedb9c] text-[#050a08]' : 'text-[#e5ebcd]/80 hover:text-[#edf3d2]'
							}`}
						>
							My Persona
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
