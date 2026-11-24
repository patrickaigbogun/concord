import { MAX_FREE_SPACES_PER_REALM, type Realm } from '../../lib/types'

interface RealmOverviewModalProps {
	realm: Realm
	activeSpaceId: string
	onSelectSpace: (spaceId: string) => void
	onCreateSpace?: () => void
	onClose: () => void
}

export function RealmOverviewModal({
	realm,
	activeSpaceId,
	onSelectSpace,
	onCreateSpace,
	onClose,
}: RealmOverviewModalProps) {
	const memberCount = realm.isDirect ? 2 : 18 + realm.spaces.length * 4
	const onlineCount = realm.isDirect ? 2 : Math.max(3, Math.floor(memberCount * 0.28))
	const wordsThisWeek = realm.isDirect ? 2410 : 8420 + realm.spaces.length * 1060

	return (
		<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
			<div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-[#101014] border border-white/10 shadow-2xl">
				{/* Cover Hero */}
				<div className="relative h-40 w-full overflow-hidden">
					<img src={realm.coverUrl} alt={realm.name} className="w-full h-full object-cover" />
					<div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/40 to-transparent" />
					<button
						type="button"
						onClick={onClose}
						className="absolute top-3.5 right-3.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-xs font-semibold text-white cursor-pointer"
					>
						Close
					</button>
					<div className="absolute bottom-3 left-5 right-5">
						<div className="text-[10px] uppercase tracking-widest text-[#c4b5fd] font-semibold">
							{realm.isDirect ? 'Direct Realm' : 'Realm Overview'}
						</div>
						<h2 className="text-xl font-bold text-white tracking-tight">{realm.name}</h2>
					</div>
				</div>

				<div className="p-5 space-y-5">
					{realm.description && (
						<p className="text-sm font-editorial text-zinc-300 leading-relaxed">{realm.description}</p>
					)}

					{/* Core Counts */}
					<div className="grid grid-cols-3 gap-2.5">
						<div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
							<div className="text-lg font-bold text-white">
								{realm.spaces.length}
								<span className="text-xs font-normal text-zinc-500">/{MAX_FREE_SPACES_PER_REALM}</span>
							</div>
							<div className="text-[11px] text-zinc-400 mt-0.5">Spaces</div>
						</div>
						<div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
							<div className="text-lg font-bold text-white">{memberCount}</div>
							<div className="text-[11px] text-zinc-400 mt-0.5">People</div>
						</div>
						<div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
							<div className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
								{onlineCount}
							</div>
							<div className="text-[11px] text-zinc-400 mt-0.5">Online</div>
						</div>
					</div>

					{/* Fun / Playful Realm Stats */}
					<div className="rounded-2xl bg-[#15151b] border border-white/[0.07] p-4 space-y-2.5">
						<div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
							Realm Pulse &amp; Fun Stats
						</div>
						<div className="grid grid-cols-2 gap-3 text-xs">
							<div>
								<div className="text-zinc-500">Words written this week</div>
								<div className="font-semibold text-zinc-100 mt-0.5">
									{wordsThisWeek.toLocaleString()} words
								</div>
								<div className="text-[10px] text-[#a78bfa]">~1 short novella</div>
							</div>
							<div>
								<div className="text-zinc-500">Peak writing hour</div>
								<div className="font-semibold text-zinc-100 mt-0.5">11:00 PM</div>
								<div className="text-[10px] text-zinc-400">Certified night owls</div>
							</div>
							<div>
								<div className="text-zinc-500">Curator</div>
								<div className="font-semibold text-zinc-100 mt-0.5">
									{realm.note?.curatorName || 'Galediç'}
								</div>
							</div>
							<div>
								<div className="text-zinc-500">Avg. message vibe</div>
								<div className="font-semibold text-zinc-100 mt-0.5">Thoughtful essays</div>
							</div>
						</div>
					</div>

					{/* All Spaces in Realm */}
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
								Spaces in {realm.name}
							</div>
							{onCreateSpace && (
								<button
									type="button"
									onClick={() => {
										onClose()
										onCreateSpace()
									}}
									className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/30 text-[11px] font-semibold text-[#c4b5fd] hover:text-white transition cursor-pointer"
								>
									<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									<span>New Space</span>
								</button>
							)}
						</div>
						<div className="grid grid-cols-2 gap-2">
							{realm.spaces.map((sp) => {
								const active = sp.id === activeSpaceId
								return (
									<button
										key={sp.id}
										type="button"
										onClick={() => {
											onSelectSpace(sp.id)
											onClose()
										}}
										className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
											active
												? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40 text-white'
												: 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 text-zinc-300'
										}`}
									>
										<div
											className={`w-7 h-7 rounded-full bg-gradient-to-br ${sp.orbGradient} shrink-0 flex items-center justify-center text-[10px] font-bold text-white`}
										>
											{sp.name[0]}
										</div>
										<div className="min-w-0">
											<div className="text-xs font-semibold truncate">{sp.name}</div>
											{sp.description && (
												<div className="text-[10px] text-zinc-500 truncate">{sp.description}</div>
											)}
										</div>
									</button>
								)
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
