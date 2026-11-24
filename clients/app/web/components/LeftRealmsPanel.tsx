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
		<aside className="h-full flex flex-col bg-[#0d0d10] border-r border-white/[0.07] select-none">
			{/* Top Bar: Concord Mark + 3-Mode View Switcher */}
			<div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2.5">
					<svg className="w-6 h-6 text-[#8b5cf6] shrink-0" viewBox="0 0 100 100" fill="none">
						<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
						<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
					</svg>
					<span className="text-sm font-bold tracking-tight text-zinc-100">Realms</span>
				</div>

				{/* 3 View Modes: 2-Col Titled (Default) | Visual-Only | Classic List */}
				<div className="flex items-center rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
					<button
						type="button"
						title="2-Column Grid with Titles"
						onClick={() => onChangeViewMode('grid-titled')}
						className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
							viewMode === 'grid-titled'
								? 'bg-white/12 text-white'
								: 'text-zinc-500 hover:text-zinc-300'
						}`}
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<rect x="3" y="3" width="7" height="7" rx="1.5" />
							<rect x="14" y="3" width="7" height="7" rx="1.5" />
							<rect x="3" y="14" width="7" height="7" rx="1.5" />
							<rect x="14" y="14" width="7" height="7" rx="1.5" />
						</svg>
					</button>
					<button
						type="button"
						title="Visual-Only Compact Grid"
						onClick={() => onChangeViewMode('grid-visual')}
						className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
							viewMode === 'grid-visual'
								? 'bg-white/12 text-white'
								: 'text-zinc-500 hover:text-zinc-300'
						}`}
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
						title="Classic List"
						onClick={() => onChangeViewMode('list')}
						className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
							viewMode === 'list'
								? 'bg-white/12 text-white'
								: 'text-zinc-500 hover:text-zinc-300'
						}`}
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="4" y1="6" x2="20" y2="6" />
							<line x1="4" y1="12" x2="20" y2="12" />
							<line x1="4" y1="18" x2="20" y2="18" />
						</svg>
					</button>
				</div>
			</div>

			{/* Search Bar */}
			<div className="px-4 pb-3">
				<div className="relative">
					<svg
						className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
						className="w-full rounded-xl bg-white/[0.04] border border-white/[0.07] pl-8 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 transition"
					/>
				</div>
			</div>

			{/* Realms Canvas (Visual Grid or Classic List) */}
			<div className="flex-1 overflow-y-auto no-scrollbar px-3.5 pb-4">
				{viewMode === 'grid-titled' && (
					<div className="grid grid-cols-2 gap-3">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									onClick={() => onSelectRealm(realm.id)}
									className="group text-left focus:outline-none cursor-pointer"
								>
									<div
										className={`relative aspect-square w-full rounded-2xl overflow-hidden border transition-all duration-200 ${
											active
												? 'border-[#8b5cf6] ring-2 ring-[#8b5cf6]/35 scale-[0.98]'
												: 'border-white/[0.08] group-hover:border-white/20'
										}`}
									>
										<img
											src={realm.coverUrl}
											alt={realm.name}
											className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
										<div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

										{realm.unreadCount ? (
											<span className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full bg-[#8b5cf6] text-[10px] font-bold text-white flex items-center justify-center shadow">
												{realm.unreadCount}
											</span>
										) : null}

										{realm.note ? (
											<span
												title={`Note: ${realm.note.text}`}
												className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black/60"
											/>
										) : null}
									</div>
									<div
										className={`mt-1.5 px-0.5 text-xs font-medium truncate transition ${
											active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
										}`}
									>
										{realm.name}
									</div>
								</button>
							)
						})}
					</div>
				)}

				{viewMode === 'grid-visual' && (
					<div className="grid grid-cols-3 gap-2">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									title={realm.name}
									onClick={() => onSelectRealm(realm.id)}
									className={`relative aspect-square w-full rounded-xl overflow-hidden border transition-all cursor-pointer ${
										active
											? 'border-[#8b5cf6] ring-2 ring-[#8b5cf6]/40 scale-[0.96]'
											: 'border-white/[0.08] hover:border-white/25'
									}`}
								>
									<img src={realm.coverUrl} alt={realm.name} className="w-full h-full object-cover" />
									{realm.unreadCount ? (
										<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#8b5cf6] ring-2 ring-black/70" />
									) : null}
								</button>
							)
						})}
					</div>
				)}

				{viewMode === 'list' && (
					<div className="space-y-1">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									onClick={() => onSelectRealm(realm.id)}
									className={`w-full flex items-center gap-3 p-2 rounded-xl transition cursor-pointer text-left ${
										active
											? 'bg-white/[0.08] text-white'
											: 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
									}`}
								>
									<img
										src={realm.coverUrl}
										alt={realm.name}
										className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
									/>
									<div className="min-w-0 flex-1">
										<div className="text-xs font-semibold truncate">{realm.name}</div>
										<div className="text-[11px] text-zinc-500 truncate">
											{realm.isDirect ? 'Direct' : `${realm.spaces.length} spaces`}
										</div>
									</div>
									{realm.unreadCount ? (
										<span className="min-w-5 h-5 px-1.5 rounded-full bg-[#8b5cf6] text-[10px] font-bold text-white flex items-center justify-center">
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
			<div className="p-3 border-t border-white/[0.07] bg-[#0a0a0d]">
				{session ? (
					<div className="flex items-center justify-between gap-2">
						<a
							href={`${CONCORD_CONFIG.idUrl}/profile`}
							target="_blank"
							rel="noreferrer"
							className="flex items-center gap-2.5 min-w-0 group"
						>
							{session.user.avatar_url ? (
								<img
									src={session.user.avatar_url}
									alt={session.user.display_name}
									className="w-8 h-8 rounded-full object-cover border border-white/10"
								/>
							) : (
								<div className="w-8 h-8 rounded-full bg-[#8b5cf6] flex items-center justify-center text-xs font-bold text-white">
									{session.user.display_name?.[0] || session.user.username?.[0]}
								</div>
							)}
							<div className="min-w-0">
								<div className="text-xs font-semibold text-zinc-100 truncate group-hover:text-white">
									{session.user.display_name}
								</div>
								<div className="text-[10px] text-zinc-500 truncate">@{session.user.username}</div>
							</div>
						</a>
						<button
							type="button"
							onClick={onSignOut}
							className="text-[11px] text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition cursor-pointer"
						>
							Out
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={onSignIn}
						className="w-full py-2 px-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer"
					>
						Sign in with Concord ID
					</button>
				)}
			</div>
		</aside>
	)
}
