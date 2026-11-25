import { useRef } from 'react'
import { hapticTap } from '../../lib/haptics'
import { formatOrbLabel, MAX_FREE_SPACES_PER_REALM, type Space } from '../../lib/types'

interface SpaceOrbBarProps {
	spaces: Space[]
	activeSpaceId: string
	expanded: boolean
	onToggleExpanded: () => void
	onSelectSpace: (spaceId: string) => void
}

export function SpaceOrbBar({
	spaces,
	activeSpaceId,
	expanded,
	onToggleExpanded,
	onSelectSpace,
}: SpaceOrbBarProps) {
	const scrollerRef = useRef<HTMLDivElement>(null)
	const visibleSpaces = spaces.slice(0, MAX_FREE_SPACES_PER_REALM)
	const activeIndex = Math.max(
		0,
		visibleSpaces.findIndex((s) => s.id === activeSpaceId)
	)
	const activeSpace = visibleSpaces[activeIndex] || visibleSpaces[0]

	if (visibleSpaces.length <= 1) return null

	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (!scrollerRef.current) return
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
			scrollerRef.current.scrollLeft += e.deltaY
		}
	}

	const count = visibleSpaces.length
	const mid = (count - 1) / 2

	return (
		<div className="px-4 pt-1 pb-1.5 flex flex-col items-center">
			{/* Collapsible Pill Handle */}
			<button
				type="button"
				onClick={() => {
					hapticTap()
					onToggleExpanded()
				}}
				className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16161c] hover:bg-[#1e1e26] text-[13px] text-zinc-300 hover:text-white transition cursor-pointer"
			>
				<span
					className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${
						activeSpace?.orbGradient || 'from-violet-500 to-indigo-600'
					}`}
				/>
				<span className="font-semibold text-white">{activeSpace?.name}</span>
				<span className="text-zinc-600">&bull;</span>
				<span className="text-[12px] text-zinc-400">{visibleSpaces.length} spaces</span>
				<svg
					className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
						expanded ? 'rotate-180' : ''
					}`}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.4"
				>
					<polyline points="18 15 12 9 6 15" />
				</svg>
			</button>

			{/* Expanded Orb Arch: True Symmetric Upward Rainbow Curve on Mobile, Straight Row on Desktop */}
			{expanded && (
				<div
					ref={scrollerRef}
					onWheel={handleWheel}
					data-no-pane-swipe="true"
					className="w-full max-w-xl mt-1 overflow-x-auto no-scrollbar"
				>
					<div className="flex items-end justify-center gap-3 md:gap-3 px-4 pt-8 pb-2 min-w-max mx-auto">
						{visibleSpaces.map((space, idx) => {
							const isActive = space.id === activeSpaceId
							// Normalized distance from center of the bar (-1 at edges, 0 at center)
							const norm = mid > 0 ? (idx - mid) / mid : 0
							// Smooth upward arch: center rises +24px, outer edges sit gently lower at 0px
							const archLiftPx = Math.round((1 - norm * norm) * 24)
							const label = formatOrbLabel(space.name)

							return (
								<button
									key={space.id}
									type="button"
									title={space.name}
									onClick={() => {
										hapticTap()
										onSelectSpace(space.id)
									}}
									style={{
										transform: `translateY(-${archLiftPx}px)`,
									}}
									className="group flex flex-col items-center gap-1 transition-transform duration-300 ease-out cursor-pointer focus:outline-none md:!transform-none"
								>
									<div
										className={`relative rounded-full bg-gradient-to-br ${space.orbGradient} flex items-center justify-center font-semibold text-white transition-all duration-200 ${
											isActive
												? 'w-12 h-12 md:w-10 md:h-10 text-[12px] ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0e] shadow-lg shadow-violet-500/30 scale-110'
												: 'w-10 h-10 md:w-9 md:h-9 text-[11px] opacity-80 hover:opacity-100 hover:scale-105'
										}`}
									>
										<span>{label}</span>
										{space.unread && !isActive ? (
											<span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#0a0a0e]" />
										) : null}
									</div>
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
