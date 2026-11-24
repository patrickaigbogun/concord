import { useMemo, useState } from 'react'
import type { ConcordSession } from '../../lib/auth'
import { CONCORD_CONFIG } from '../../lib/config'
import type { Realm, RoomViewMode } from '../../lib/types'

interface LeftRealmsPanelProps {
	realms: Realm[]
	activeRealmId: string
	viewMode: RoomViewMode
	onChangeViewMode: (mode: RoomViewMode) => void
	onSelectRealm: (realmId: string) => void
	onCreateRealm?: () => void
	session: ConcordSession | null
	onSignIn: () => void
	onSignOut: () => void
}

export function LeftRealmsPanel({
	realms,
	activeRealmId,
	viewMode,
	onChangeViewMode,
	onSelectRealm,
	onCreateRealm,
	session,
	onSignIn,
	onSignOut,
}: LeftRealmsPanelProps) {
	const [query, setQuery] = useState('')

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return realms
		return realms.filter(
			(r) =>
				r.name.toLowerCase().includes(q) ||
				r.spaces.some((s) => s.name.toLowerCase().includes(q))
		)
	}, [realms, query])

	return (
		<aside className="h-full flex flex-col bg-[#0d0d11] select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Top Bar: Concord Mark + Create + 3-Mode View Switcher */}
			<div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2.5">
					<svg className="w-7 h-7 text-[#8b5cf6] shrink-0" viewBox="0 0 100 100" fill="none">
						<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
						<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
					</svg>
					<span className="text-[18px] font-bold tracking-tight text-white">Realms</span>
				</div>

				<div className="flex items-center gap-2">
					{onCreateRealm && (
						<button
							type="button"
							title="Create Realm"
							aria-label="Create Realm"
							onClick={onCreateRealm}
							className="w-8 h-8 rounded-full bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 text-[#c4b5fd] hover:text-white flex items-center justify-center transition cursor-pointer"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</button>
					)}

					<div className="flex items-center rounded-xl bg-[#16161c] p-1 gap-0.5">
						<button
							type="button"
							title="2-Column Grid"
							onClick={() => onChangeViewMode('grid-titled')}
							className={`p-1.5 rounded-lg transition cursor-pointer ${
								viewMode === 'grid-titled'
									? 'bg-white/15 text-white'
									: 'text-zinc-500 hover:text-zinc-200'
							}`}
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="7" height="7" rx="1.5" />
								<rect x="14" y="3" width="7" height="7" rx="1.5" />
								<rect x="3" y="14" width="7" height="7" rx="1.5" />
								<rect x="14" y="14" width="7" height="7" rx="1.5" />
							</svg>
						</button>
						<button
							type="button"
							title="Compact Grid"
							onClick={() => onChangeViewMode('grid-visual')}
							className={`p-1.5 rounded-lg transition cursor-pointer ${
								viewMode === 'grid-visual'
									? 'bg-white/15 text-white'
									: 'text-zinc-500 hover:text-zinc-200'
							}`}
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="4.5" height="4.5" rx="1" />
								<rect x="9.75" y="3" width="4.5" height="4.5" rx="1" />
								<rect x="16.5" y="3" width="4.5" height="4.5" rx="1" />
								<rect x="3" y="9.75" width="4.5" height="4.5" rx="1" />
								<rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
								<rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1" />
								<rect x="3" y="16.5" width="4.5" height="4.5" rx="1" />
								<rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1" />
								<rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1" />
							</svg>
						</button>
						<button
							type="button"
							title="List View"
							onClick={() => onChangeViewMode('list')}
							className={`p-1.5 rounded-lg transition cursor-pointer ${
								viewMode === 'list'
									? 'bg-white/15 text-white'
									: 'text-zinc-500 hover:text-zinc-200'
							}`}
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<line x1="4" y1="6" x2="20" y2="6" />
								<line x1="4" y1="12" x2="20" y2="12" />
								<line x1="4" y1="18" x2="20" y2="18" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			{/* Search Bar */}
			<div className="px-4 pb-3.5">
				<div className="relative">
					<svg
						className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search realms…"
						className="w-full rounded-2xl bg-[#16161c] pl-10 pr-4 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/50 transition"
					/>
				</div>
			</div>

			{/* Realms Canvas: Boxes with Round Images Inside + Title Text */}
			<div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
				{viewMode === 'grid-titled' && (
					<div className="grid grid-cols-2 gap-3">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									onClick={() => onSelectRealm(realm.id)}
									className={`group relative rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center transition-all duration-200 cursor-pointer focus:outline-none ${
										active
											? 'bg-[#1d1830] ring-2 ring-[#8b5cf6]'
											: 'bg-[#15151b] hover:bg-[#1b1b23]'
									}`}
								>
									{realm.unreadCount ? (
										<span className="absolute top-2.5 right-2.5 min-w-5 h-5 px-1.5 rounded-full bg-[#8b5cf6] text-[11px] font-bold text-white flex items-center justify-center">
											{realm.unreadCount}
										</span>
									) : null}

									<div className="relative">
										<img
											src={realm.coverUrl}
											alt={realm.name}
											className="w-16 h-16 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
										/>
										{realm.note ? (
											<span
												title={`Note: ${realm.note.text}`}
												className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-[#15151b]"
											/>
										) : null}
									</div>

									<div className="w-full space-y-0.5">
										<div
											className={`text-[14px] font-semibold truncate transition ${
												active ? 'text-white' : 'text-zinc-200 group-hover:text-white'
											}`}
										>
											{realm.name}
										</div>
										<div className="text-[12px] text-zinc-500 truncate">
											{realm.isDirect ? 'Direct' : `${realm.spaces.length} spaces`}
										</div>
									</div>
								</button>
							)
						})}
					</div>
				)}

				{viewMode === 'grid-visual' && (
					<div className="grid grid-cols-3 gap-2.5">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									title={realm.name}
									onClick={() => onSelectRealm(realm.id)}
									className={`relative aspect-square rounded-2xl p-2 flex items-center justify-center transition-all cursor-pointer ${
										active
											? 'bg-[#1d1830] ring-2 ring-[#8b5cf6]'
											: 'bg-[#15151b] hover:bg-[#1b1b23]'
									}`}
								>
									<img
										src={realm.coverUrl}
										alt={realm.name}
										className="w-12 h-12 rounded-full object-cover"
									/>
									{realm.unreadCount ? (
										<span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
									) : null}
								</button>
							)
						})}
					</div>
				)}

				{viewMode === 'list' && (
					<div className="space-y-1.5">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									onClick={() => onSelectRealm(realm.id)}
									className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition cursor-pointer text-left ${
										active
											? 'bg-[#1d1830] text-white'
											: 'bg-transparent hover:bg-[#16161c] text-zinc-300'
									}`}
								>
									<img
										src={realm.coverUrl}
										alt={realm.name}
										className="w-11 h-11 rounded-full object-cover shrink-0"
									/>
									<div className="min-w-0 flex-1">
										<div className="text-[15px] font-semibold truncate text-white">{realm.name}</div>
										<div className="text-[13px] text-zinc-400 truncate">
											{realm.isDirect ? 'Direct' : `${realm.spaces.length} spaces`}
										</div>
									</div>
									{realm.unreadCount ? (
										<span className="min-w-6 h-6 px-2 rounded-full bg-[#8b5cf6] text-[12px] font-bold text-white flex items-center justify-center">
											{realm.unreadCount}
										</span>
									) : null}
								</button>
							)
						})}
					</div>
				)}
			</div>

			{/* Footer: Concord ID Profile */}
			<div className="px-4 py-3.5 bg-[#0a0a0e]">
				{session ? (
					<div className="flex items-center justify-between gap-3">
						<a
							href={`${CONCORD_CONFIG.idUrl}/profile`}
							target="_blank"
							rel="noreferrer"
							className="flex items-center gap-3 min-w-0 group"
						>
							{session.user.avatar_url ? (
								<img
									src={session.user.avatar_url}
									alt={session.user.display_name}
									className="w-10 h-10 rounded-full object-cover shrink-0"
								/>
							) : (
								<div className="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center text-[15px] font-bold text-white shrink-0">
									{session.user.display_name?.[0] || session.user.username?.[0]}
								</div>
							)}
							<div className="min-w-0">
								<div className="text-[14px] font-semibold text-white truncate">
									{session.user.display_name}
								</div>
								<div className="text-[12px] text-zinc-400 truncate">@{session.user.username}</div>
							</div>
						</a>
						<button
							type="button"
							onClick={onSignOut}
							className="text-[13px] font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl bg-[#16161c] hover:bg-[#202028] transition cursor-pointer"
						>
							Out
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={onSignIn}
						className="w-full py-3 px-4 rounded-2xl bg-white text-black hover:bg-zinc-200 text-[14px] font-bold transition cursor-pointer"
					>
						Sign in with Concord ID
					</button>
				)}
			</div>
		</aside>
	)
}
