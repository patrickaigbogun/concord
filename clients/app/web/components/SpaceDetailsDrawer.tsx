import { useEffect, useState } from 'react'
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

	// Editable Space state (curator role)
	const [editingSpace, setEditingSpace] = useState(false)
	const [spaceName, setSpaceName] = useState(space.name)
	const [spaceDesc, setSpaceDesc] = useState(space.description || '')

	// Realm/Space Persona state
	const [title, setTitle] = useState(persona.title || defaultTitle)
	const [mood, setMood] = useState(persona.mood || '')
	const [tag, setTag] = useState(persona.tag || '')
	const [isAnonymous, setIsAnonymous] = useState(persona.is_anonymous)
	const [savingPersona, setSavingPersona] = useState(false)
	const [savedFeedback, setSavedFeedback] = useState(false)
	const [personaError, setPersonaError] = useState<string | null>(null)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

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
			className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="relative w-full sm:max-w-lg h-[86dvh] sm:h-auto sm:max-h-[86dvh] rounded-t-3xl sm:rounded-3xl bg-[#101015] shadow-2xl flex flex-col overflow-hidden"
			>
				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto no-scrollbar pb-24">
					{tab === 'space' ? (
						<div>
							{/* Space Backdrop Hero + Centered Orb */}
							<div className="relative h-44 w-full overflow-hidden">
								<img
									src={realm.coverUrl}
									alt={realm.name}
									className="w-full h-full object-cover opacity-70"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-[#101015] via-[#101015]/55 to-black/30" />

								<button
									type="button"
									onClick={onClose}
									aria-label="Close space drawer"
									className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
								>
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
										<path d="M18 6L6 18" />
										<path d="M6 6l12 12" />
									</svg>
								</button>

								<span className="absolute top-3.5 left-4 px-3 py-1 rounded-full bg-black/55 text-[12px] font-semibold text-zinc-200">
									{role === 'curator' ? 'Curator' : 'Member'}
								</span>

								{/* Centered Space Orb + Name */}
								<div className="absolute bottom-3 inset-x-5 flex flex-col items-center text-center">
									<div
										className={`w-16 h-16 rounded-full bg-gradient-to-br ${space.orbGradient} ring-4 ring-[#101015] flex items-center justify-center text-[20px] font-bold text-white shadow-xl`}
									>
										{space.name[0]}
									</div>
									<h2 className="mt-2 text-[22px] font-bold text-white tracking-tight">{space.name}</h2>
									<p className="text-[13px] text-zinc-400">{realm.name}</p>
								</div>
							</div>

							<div className="px-5 pt-4 space-y-5">
								{/* Space Description / Role-Based Edit */}
								{editingSpace && canEditSpace ? (
									<form onSubmit={handleSaveSpaceDetails} className="rounded-2xl bg-[#16161e] p-4 space-y-3">
										<div className="space-y-1.5">
											<label className="text-[13px] font-semibold text-zinc-300">Space Name</label>
											<input
												type="text"
												value={spaceName}
												onChange={(e) => setSpaceName(e.target.value)}
												maxLength={48}
												className="w-full rounded-xl bg-[#0e0e14] px-3.5 py-2.5 text-[15px] text-white focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
											/>
										</div>
										<div className="space-y-1.5">
											<label className="text-[13px] font-semibold text-zinc-300">Description</label>
											<textarea
												value={spaceDesc}
												onChange={(e) => setSpaceDesc(e.target.value)}
												rows={2}
												maxLength={180}
												className="w-full rounded-xl bg-[#0e0e14] px-3.5 py-2.5 text-[15px] text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
											/>
										</div>
										<div className="flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setEditingSpace(false)}
												className="px-4 py-2 rounded-xl bg-white/10 text-[13px] font-semibold text-zinc-200 cursor-pointer"
											>
												Cancel
											</button>
											<button
												type="submit"
												className="px-4 py-2 rounded-xl bg-white text-black text-[13px] font-bold cursor-pointer"
											>
												Save
											</button>
										</div>
									</form>
								) : (
									<div className="rounded-2xl bg-[#16161e] p-4 flex items-start justify-between gap-3">
										<p className="text-[14px] text-zinc-300 leading-relaxed">
											{space.description || realm.description || 'A quiet Space for conversation and shared files.'}
										</p>
										{canEditSpace && (
											<button
												type="button"
												onClick={() => setEditingSpace(true)}
												className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[13px] font-semibold text-white shrink-0 cursor-pointer"
											>
												Edit
											</button>
										)}
									</div>
								)}

								{/* Core Stats */}
								<div className="grid grid-cols-3 gap-2.5">
									<div className="rounded-2xl bg-[#16161e] p-3.5 text-center">
										<div className="text-[20px] font-bold text-white">
											{realm.spaces.length}
											<span className="text-[13px] font-normal text-zinc-500">/{MAX_FREE_SPACES_PER_REALM}</span>
										</div>
										<div className="text-[12px] text-zinc-400 mt-0.5">Spaces</div>
									</div>
									<div className="rounded-2xl bg-[#16161e] p-3.5 text-center">
										<div className="text-[20px] font-bold text-white">{memberCount}</div>
										<div className="text-[12px] text-zinc-400 mt-0.5">People</div>
									</div>
									<div className="rounded-2xl bg-[#16161e] p-3.5 text-center">
										<div className="text-[20px] font-bold text-emerald-400 flex items-center justify-center gap-1.5">
											<span className="w-2 h-2 rounded-full bg-emerald-400" />
											{onlineCount}
										</div>
										<div className="text-[12px] text-zinc-400 mt-0.5">Online</div>
									</div>
								</div>

								{/* Activity Pulse */}
								<div className="rounded-2xl bg-[#16161e] p-4 space-y-3">
									<div className="text-[14px] font-semibold text-zinc-300">Space Pulse</div>
									<div className="grid grid-cols-2 gap-3 text-[14px]">
										<div>
											<div className="text-[12px] text-zinc-500">Words this week</div>
											<div className="font-semibold text-white mt-0.5">
												{wordsThisWeek.toLocaleString()} words
											</div>
										</div>
										<div>
											<div className="text-[12px] text-zinc-500">Peak hour</div>
											<div className="font-semibold text-white mt-0.5">11:00 PM</div>
										</div>
									</div>
								</div>

								{/* All Spaces in Realm */}
								<div className="space-y-2.5">
									<div className="flex items-center justify-between">
										<div className="text-[14px] font-semibold text-zinc-300">
											Spaces in {realm.name}
										</div>
										{onCreateSpace && (
											<button
												type="button"
												onClick={() => {
													onClose()
													onCreateSpace()
												}}
												className="px-3 py-1.5 rounded-xl bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 text-[13px] font-semibold text-[#c4b5fd] cursor-pointer"
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
															? 'bg-[#221a38] text-white ring-1 ring-[#8b5cf6]'
															: 'bg-[#16161e] hover:bg-[#1d1d27] text-zinc-300'
													}`}
												>
													<div
														className={`w-8 h-8 rounded-full bg-gradient-to-br ${sp.orbGradient} shrink-0 flex items-center justify-center text-[12px] font-bold text-white`}
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
						/* Tab 2: Realm/Space Persona (Title + Mood replacing bio + Tag + Anonymous) */
						<form onSubmit={handlePersonaSubmit} className="p-5 space-y-5">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-[20px] font-bold text-white">Your Persona</h2>
									<p className="text-[13px] text-zinc-400">
										How you appear in {realm.name} / {space.name}
									</p>
								</div>
								<button
									type="button"
									onClick={onClose}
									aria-label="Close persona drawer"
									className="w-9 h-9 rounded-full bg-[#1a1a23] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
								>
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
										<path d="M18 6L6 18" />
										<path d="M6 6l12 12" />
									</svg>
								</button>
							</div>

							{/* Live Preview Card */}
							<div className="rounded-2xl bg-[#16161e] p-4 flex items-center gap-3.5">
								<div className="w-12 h-12 rounded-full bg-[#6d28d9] flex items-center justify-center text-[17px] font-bold text-white shrink-0">
									{isAnonymous ? '?' : (title || defaultTitle)[0]?.toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-[16px] font-bold text-white truncate">
											{isAnonymous ? 'Anonymous' : title || defaultTitle}
										</span>
										{tag && !isAnonymous && (
											<span className="text-[13px] text-[#c4b5fd] truncate">@{tag.replace(/^@+/, '')}</span>
										)}
									</div>
									<p className="text-[13px] text-zinc-400 truncate mt-0.5">
										{mood || 'Set a mood for this Realm…'}
									</p>
								</div>
							</div>

							{/* Title (Realm/Space-specific name) */}
							<div className="space-y-1.5">
								<label htmlFor="persona-title" className="block text-[14px] font-semibold text-zinc-200">
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
									className="w-full rounded-2xl bg-[#16161e] px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] disabled:opacity-45"
								/>
							</div>

							{/* Mood (Replaces Bio) */}
							<div className="space-y-2">
								<label htmlFor="persona-mood" className="block text-[14px] font-semibold text-zinc-200">
									Mood
								</label>
								<input
									id="persona-mood"
									type="text"
									value={mood}
									onChange={(e) => setMood(e.target.value)}
									placeholder="What's your current mood or vibe?"
									maxLength={90}
									className="w-full rounded-2xl bg-[#16161e] px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
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
											className="px-3 py-1 rounded-full bg-[#1a1a24] hover:bg-[#242432] text-[12px] font-medium text-zinc-300 cursor-pointer"
										>
											{preset}
										</button>
									))}
								</div>
							</div>

							{/* Optional Space Tag */}
							<div className="space-y-1.5">
								<label htmlFor="persona-handle" className="block text-[14px] font-semibold text-zinc-200">
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
									className="w-full rounded-2xl bg-[#16161e] px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] disabled:opacity-45"
								/>
							</div>

							{/* Anonymous Toggle */}
							<label className="flex items-center justify-between rounded-2xl bg-[#16161e] px-4 py-3.5 cursor-pointer">
								<div>
									<div className="text-[15px] font-semibold text-white">Appear Anonymous</div>
									<div className="text-[13px] text-zinc-400">Hide your title &amp; tag in this Space</div>
								</div>
								<input
									type="checkbox"
									checked={isAnonymous}
									onChange={(e) => setIsAnonymous(e.target.checked)}
									className="w-5 h-5 accent-[#8b5cf6]"
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
								className="w-full py-3.5 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-45 text-[15px] font-bold transition cursor-pointer"
							>
								{savingPersona ? 'Saving…' : savedFeedback ? 'Persona Saved' : 'Save Persona'}
							</button>
						</form>
					)}
				</div>

				{/* Floating Bottom Toggle Bar (Space <-> Persona) */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 px-5 bg-gradient-to-t from-[#101015] via-[#101015]/90 to-transparent flex justify-center">
					<div className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full bg-[#1b1b26] shadow-2xl shadow-black/80">
						<button
							type="button"
							onClick={() => {
								hapticTap()
								setTab('space')
							}}
							className={`px-5 py-2 rounded-full text-[14px] font-semibold transition cursor-pointer ${
								tab === 'space' ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'
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
								tab === 'persona' ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'
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
