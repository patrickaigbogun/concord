import { useMemo, useState } from 'react'
import type { ConcordSession } from '../../lib/auth'
import { CONCORD_CONFIG } from '../../lib/config'
import { hapticTap } from '../../lib/haptics'
import type { Realm, RoomViewMode } from '../../lib/types'

interface LeftRealmsPanelProps {
	realms: Realm[]
	activeRealmId: string
	viewMode: RoomViewMode
	onChangeViewMode: (mode: RoomViewMode) => void
	onSelectRealm: (realmId: string) => void
	onCreateRealm?: () => void
	onOpenSettings?: () => void
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
	onOpenSettings,
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
		<aside className="h-full flex flex-col bg-[#221d19] select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Centered Brand Header: Concord Logo + "Realms" Wordmark */}
			<div className="px-5 pt-6 pb-4 flex flex-col items-center text-center gap-2 shrink-0">
				<svg className="w-11 h-11 text-[#cedb9c]" viewBox="0 0 100 100" fill="none" aria-label="Concord">
					<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
					<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
				</svg>
				<h1 className="text-[26px] font-bold tracking-tight text-[#edf3d2] font-heading leading-none">
					Realms
				</h1>
			</div>

			{/* Large, Easy-to-See Search Bar */}
			<div className="px-4 pb-3.5 shrink-0">
				<div className="relative">
					<svg
						className="w-5 h-5 text-[#9e998c] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.2"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search realms…"
						className="w-full rounded-full bg-[#2c2621] pl-12 pr-4 py-3 text-[16px] text-[#edf3d2] placeholder:text-[#9e998c] focus:outline-none focus:ring-2 focus:ring-[#cedb9c]/60 transition"
					/>
				</div>
			</div>

			{/* Large, Prominent Grid View Toggles + Create Realm Button */}
			<div className="px-4 pb-4 flex items-center gap-2.5 shrink-0">
				<div className="flex-1 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#1b1714] p-1.5">
					<button
						type="button"
						title="Orbs Grid"
						aria-label="Orbs Grid"
						onClick={() => {
							hapticTap()
							onChangeViewMode('grid-visual')
						}}
						className={`py-2.5 rounded-xl flex items-center justify-center transition cursor-pointer ${
							viewMode === 'grid-visual'
								? 'bg-[#2f2923] text-[#edf3d2] shadow-sm'
								: 'text-[#9e998c] hover:text-[#e5ebcd]'
						}`}
					>
						<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="6" cy="6" r="2.2" />
							<circle cx="12" cy="6" r="2.2" />
							<circle cx="18" cy="6" r="2.2" />
							<circle cx="6" cy="12" r="2.2" />
							<circle cx="12" cy="12" r="2.2" />
							<circle cx="18" cy="12" r="2.2" />
							<circle cx="6" cy="18" r="2.2" />
							<circle cx="12" cy="18" r="2.2" />
							<circle cx="18" cy="18" r="2.2" />
						</svg>
					</button>

					<button
						type="button"
						title="Orbs with Titles"
						aria-label="Orbs with Titles"
						onClick={() => {
							hapticTap()
							onChangeViewMode('grid-titled')
						}}
						className={`py-2.5 rounded-xl flex items-center justify-center transition cursor-pointer ${
							viewMode === 'grid-titled'
								? 'bg-[#2f2923] text-[#edf3d2] shadow-sm'
								: 'text-[#9e998c] hover:text-[#e5ebcd]'
						}`}
					>
						<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<rect x="3" y="3" width="7.5" height="7.5" rx="2" />
							<rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
							<rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
							<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
						</svg>
					</button>

					<button
						type="button"
						title="List View"
						aria-label="List View"
						onClick={() => {
							hapticTap()
							onChangeViewMode('list')
						}}
						className={`py-2.5 rounded-xl flex items-center justify-center transition cursor-pointer ${
							viewMode === 'list'
								? 'bg-[#2f2923] text-[#edf3d2] shadow-sm'
								: 'text-[#9e998c] hover:text-[#e5ebcd]'
						}`}
					>
						<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
							<line x1="4" y1="6" x2="20" y2="6" />
							<line x1="4" y1="12" x2="20" y2="12" />
							<line x1="4" y1="18" x2="20" y2="18" />
						</svg>
					</button>
				</div>

				{onCreateRealm && (
					<button
						type="button"
						title="Create Realm"
						aria-label="Create Realm"
						onClick={() => {
							hapticTap()
							onCreateRealm()
						}}
						className="w-12 h-12 rounded-2xl bg-[#083d29] hover:bg-[#0b5237] text-[#cedb9c] ring-1 ring-[#cedb9c]/40 flex items-center justify-center transition cursor-pointer shrink-0"
					>
						<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
				)}
			</div>

			{/* Realms Grid */}
			<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-2 pb-6">
				{viewMode === 'grid-visual' && (
					<div className="grid grid-cols-3 gap-3 p-0.5">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									title={realm.name}
									onClick={() => {
										hapticTap()
										onSelectRealm(realm.id)
									}}
									className={`relative aspect-square rounded-2xl p-2 flex items-center justify-center transition-all cursor-pointer ${
										active
											? 'bg-[#083d29] hover:bg-[#0b5237] ring-2 ring-[#cedb9c]'
											: 'bg-[#2a241f] hover:bg-[#332c26]'
									}`}
								>
									<img
										src={realm.coverUrl}
										alt={realm.name}
										className="w-12 h-12 rounded-full object-cover"
									/>
									{realm.unreadCount ? (
										<span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#cedb9c]" />
									) : null}
								</button>
							)
						})}
					</div>
				)}

				{viewMode === 'grid-titled' && (
					<div className="grid grid-cols-2 gap-3 p-0.5">
						{filtered.map((realm) => {
							const active = realm.id === activeRealmId
							return (
								<button
									key={realm.id}
									type="button"
									onClick={() => {
										hapticTap()
										onSelectRealm(realm.id)
									}}
									className={`group relative rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center transition-all duration-200 cursor-pointer focus:outline-none ${
										active
											? 'bg-[#083d29] hover:bg-[#0b5237] ring-2 ring-[#cedb9c]'
											: 'bg-[#2a241f] hover:bg-[#332c26]'
									}`}
								>
									{realm.unreadCount ? (
										<span
											aria-label={`${realm.unreadCount} unread`}
											className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#cedb9c]"
										/>
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
												className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#cedb9c] ring-2 ring-[#2a241f]"
											/>
										) : null}
									</div>

									<div className="w-full space-y-0.5">
										<div
											className={`text-[14px] font-semibold truncate transition ${
												active ? 'text-[#edf3d2]' : 'text-[#e5ebcd]'
											}`}
										>
											{realm.name}
										</div>
										<div className="text-[12px] text-[#9e998c] truncate">
											{realm.isDirect ? 'Direct' : `${realm.spaces.length} spaces`}
										</div>
									</div>
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
									onClick={() => {
										hapticTap()
										onSelectRealm(realm.id)
									}}
									className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition cursor-pointer text-left ${
										active
											? 'bg-[#083d29] hover:bg-[#0b5237] ring-1 ring-[#cedb9c]/70 text-[#edf3d2]'
											: 'bg-transparent hover:bg-[#2a241f] text-[#e5ebcd]'
									}`}
								>
									<img
										src={realm.coverUrl}
										alt={realm.name}
										className="w-11 h-11 rounded-full object-cover shrink-0"
									/>
									<div className="min-w-0 flex-1">
										<div className="text-[15px] font-semibold truncate text-[#edf3d2]">{realm.name}</div>
										<div className="text-[13px] text-[#9e998c] truncate">
											{realm.isDirect ? 'Direct' : `${realm.spaces.length} spaces`}
										</div>
									</div>
									{realm.unreadCount ? (
										<span className="text-[12px] font-semibold text-[#cedb9c] shrink-0">
											{realm.unreadCount}
										</span>
									) : null}
								</button>
							)
						})}
					</div>
				)}
			</div>

			{/* Bottom Row: Sign In + Settings Button */}
			<div className="px-4 py-3.5 flex items-center gap-2.5 shrink-0">
				{session ? (
					<div className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-full bg-[#2a241f] pl-2 pr-3 py-1.5">
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
									className="w-9 h-9 rounded-full object-cover shrink-0"
								/>
							) : (
								<div className="w-9 h-9 rounded-full bg-[#083d29] flex items-center justify-center text-[14px] font-bold text-[#cedb9c] shrink-0">
									{session.user.display_name?.[0] || session.user.username?.[0]}
								</div>
							)}
							<div className="min-w-0">
								<div className="text-[14px] font-semibold text-[#edf3d2] truncate">
									{session.user.display_name}
								</div>
								<div className="text-[12px] text-[#9e998c] truncate">@{session.user.username}</div>
							</div>
						</a>
						<button
							type="button"
							onClick={onSignOut}
							className="text-[12px] font-semibold text-[#9e998c] hover:text-[#edf3d2] px-2 py-1 transition cursor-pointer shrink-0"
						>
							Out
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							hapticTap()
							onSignIn()
						}}
						className="flex-1 py-3.5 px-5 rounded-full bg-[#cedb9c] text-[#1d1916] hover:bg-[#dce7b0] text-[15px] font-bold transition cursor-pointer"
					>
						Sign in
					</button>
				)}

				<button
					type="button"
					onClick={() => {
						hapticTap()
						onOpenSettings?.()
					}}
					aria-label="Settings"
					title="Settings"
					className="w-12 h-12 rounded-full bg-[#2a241f] hover:bg-[#352e28] text-[#e5ebcd] flex items-center justify-center transition cursor-pointer shrink-0"
				>
					<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
				</button>
			</div>
		</aside>
	)
}
