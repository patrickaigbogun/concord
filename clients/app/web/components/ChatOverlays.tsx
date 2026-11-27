import { hapticTap } from '../../lib/haptics'
import type { ChatMessage, RoomViewMode, Space } from '../../lib/types'

const QUICK_REACTIONS = ['✦', '❤️', '🔥', '😂', '👏', '😮']

export function MessageContextMenu({
	msg,
	x,
	y,
	isKept,
	onClose,
	onToggleReaction,
	onReply,
	onCopy,
	onSelect,
	onForward,
	onToggleKeep,
	onCheckInfo,
	onDelete,
}: {
	msg: ChatMessage
	x: number
	y: number
	isKept: boolean
	onClose: () => void
	onToggleReaction: (msgId: string, emoji: string) => void
	onReply: (msg: ChatMessage) => void
	onCopy: (msg: ChatMessage) => void
	onSelect: (msgId: string) => void
	onForward: (msg: ChatMessage) => void
	onToggleKeep: (msgId: string) => void
	onCheckInfo: (msg: ChatMessage) => void
	onDelete: (msgId: string) => void
}) {
	return (
		<div
			data-no-pane-swipe="true"
			onClick={onClose}
			className="fixed inset-0 z-50 bg-transparent"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{ left: `${x}px`, top: `${y}px` }}
				className="fixed w-[228px] space-y-2"
			>
				{/* Quick Reactions Bar */}
				<div className="flex items-center justify-between px-2.5 py-1.5 rounded-full bg-[var(--surface)] shadow-[0_14px_40px_rgba(0,0,0,0.72)]">
					{QUICK_REACTIONS.map((emoji) => (
						<button
							key={emoji}
							type="button"
							onClick={() => onToggleReaction(msg.id, emoji)}
							className="w-8 h-8 rounded-full hover:bg-white/10 active:scale-110 text-lg flex items-center justify-center transition cursor-pointer"
						>
							{emoji}
						</button>
					))}
				</div>

				{/* Elevated Context Menu Popover */}
				<div className="rounded-2xl bg-[var(--surface)] py-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.78)]">
					<button
						type="button"
						onClick={() => onReply(msg)}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
					>
						<span>Reply</span>
						<svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="9 17 4 12 9 7" />
							<path d="M20 18v-2a4 4 0 0 0-4-4H4" />
						</svg>
					</button>

					{msg.content && (
						<button
							type="button"
							onClick={() => onCopy(msg)}
							className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
						>
							<span>Copy text</span>
							<svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="9" y="9" width="13" height="13" rx="2" />
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
							</svg>
						</button>
					)}

					<button
						type="button"
						onClick={() => {
							hapticTap()
							onSelect(msg.id)
						}}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
					>
						<span>Select message</span>
						<svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="9" />
							<polyline points="9 12 11 14 15 10" />
						</svg>
					</button>

					<button
						type="button"
						onClick={() => {
							hapticTap()
							onForward(msg)
						}}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
					>
						<span>Forward</span>
						<svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="15 17 20 12 15 7" />
							<path d="M4 18v-2a4 4 0 0 1 4-4h12" />
						</svg>
					</button>

					<button
						type="button"
						onClick={() => onToggleKeep(msg.id)}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
					>
						<span>{isKept ? 'Unkeep' : 'Keep'}</span>
						<svg className="w-4 h-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
						</svg>
					</button>

					<button
						type="button"
						onClick={() => {
							hapticTap()
							onCheckInfo(msg)
						}}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-[var(--text-bright)] hover:bg-[#312b25] flex items-center justify-between cursor-pointer"
					>
						<span>Check</span>
						<svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="9" />
							<line x1="12" y1="16" x2="12" y2="12" />
							<line x1="12" y1="8" x2="12.01" y2="8" />
						</svg>
					</button>

					<button
						type="button"
						onClick={() => onDelete(msg.id)}
						className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-red-400 hover:bg-red-500/10 flex items-center justify-between cursor-pointer"
					>
						<span>Delete</span>
						<svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	)
}

export function MessageInfoPopover({
	msg,
	onClose,
}: {
	msg: ChatMessage
	onClose: () => void
}) {
	return (
		<div
			data-no-pane-swipe="true"
			onClick={onClose}
			className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-4"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-xs rounded-2xl bg-[var(--surface)] p-5 space-y-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.78)]"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-[16px] font-bold text-[var(--text-bright)]">Message Info</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-bright)] cursor-pointer"
					>
						Close
					</button>
				</div>
				<div className="space-y-2.5 text-[14px]">
					<div className="flex items-center justify-between">
						<span className="text-[var(--text-muted)]">Author</span>
						<span className="font-semibold text-[var(--text-bright)]">{msg.authorName}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[var(--text-muted)]">Sent</span>
						<span className="font-semibold text-[var(--text-bright)]">{msg.createdAt}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[var(--text-muted)]">Read</span>
						<span className="font-semibold text-[var(--accent)]">
							{msg.isSelf ? 'Delivered' : msg.createdAt}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-[var(--text-muted)]">Edited</span>
						<span className="font-semibold text-[var(--text-muted)]">Not edited</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export function ForwardMessageSheet({
	spaces,
	onForwardToSpace,
	onClose,
}: {
	spaces: Space[]
	onForwardToSpace: (space: Space) => void
	onClose: () => void
}) {
	return (
		<div
			data-no-pane-swipe="true"
			onClick={onClose}
			className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm rounded-3xl bg-[var(--bg-chrome)] p-5 space-y-4 shadow-2xl"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-[17px] font-bold text-[var(--text-bright)]">Forward to Space</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-[14px] text-[var(--text-muted)] hover:text-[var(--text-bright)] cursor-pointer"
					>
						Close
					</button>
				</div>
				<div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
					{spaces.map((sp) => (
						<button
							key={sp.id}
							type="button"
							onClick={() => onForwardToSpace(sp)}
							className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-active)] hover:bg-[var(--bg-active-hover)] text-left cursor-pointer transition"
						>
							<span className={`w-9 h-9 rounded-full bg-gradient-to-br ${sp.orbGradient} flex items-center justify-center text-[13px] font-bold text-white shrink-0`}>
								{sp.name[0]}
							</span>
							<span className="text-[15px] font-semibold text-[var(--text-bright)] truncate">{sp.name}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}

export function SettingsSheet({
	viewMode,
	onClose,
}: {
	viewMode: RoomViewMode
	onClose: () => void
}) {
	return (
		<div
			data-no-pane-swipe="true"
			onClick={onClose}
			className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm rounded-3xl bg-[var(--bg-chrome)] p-5 space-y-4 shadow-2xl"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-[19px] font-bold text-[var(--text-bright)] font-heading">Settings</h3>
					<button
						type="button"
						onClick={onClose}
						className="w-9 h-9 rounded-full bg-[var(--bg-active)] text-[var(--text)] hover:text-[var(--text-bright)] flex items-center justify-center cursor-pointer"
					>
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
							<path d="M18 6L6 18" />
							<path d="M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div className="space-y-2">
					<a
						href="https://id.dexx.systems/profile"
						target="_blank"
						rel="noopener noreferrer"
						className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-active)] hover:bg-[var(--bg-active-hover)] text-[15px] font-semibold text-[var(--text-bright)] transition"
					>
						<span>Concord ID Profile</span>
						<span className="text-[13px] text-[var(--text-muted)]">Open</span>
					</a>

					<div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-active)] text-[15px] text-[var(--text)]">
						<span className="font-semibold">Default Realms View</span>
						<span className="text-[13px] text-[var(--accent)] font-semibold">
							{viewMode === 'grid-visual' ? 'Orbs' : viewMode === 'grid-titled' ? 'Cards' : 'List'}
						</span>
					</div>

					<div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-active)] text-[15px] text-[var(--text)]">
						<span className="font-semibold">Version</span>
						<span className="text-[13px] text-[var(--text-muted)]">Concord 0.1.0</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export function ImageLightbox({
	url,
	filename,
	onClose,
}: {
	url: string
	filename: string
	onClose: () => void
}) {
	return (
		<div
			onClick={onClose}
			className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
		>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close image"
				className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
			>
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
			<img
				src={url}
				alt={filename}
				onClick={(e) => e.stopPropagation()}
				className="max-w-full max-h-[88dvh] rounded-2xl object-contain shadow-2xl"
			/>
		</div>
	)
}
