import { useCallback, useEffect, useRef, useState } from 'react'
import { hapticTap } from '../../lib/haptics'
import { formatOrbLabel, MAX_FREE_SPACES_PER_REALM, type Space } from '../../lib/types'

interface SpaceOrbBarProps {
	spaces: Space[]
	activeSpaceId: string
	expanded: boolean
	onToggleExpanded: () => void
	onSelectSpace: (spaceId: string) => void
}

const DIAL_RADIUS = 220
const STEP_DEG = 22
const PX_PER_SLOT = DIAL_RADIUS * ((STEP_DEG * Math.PI) / 180)
const VISIBLE_HALF_SLOTS = 3 // Renders 7 slots: -3..+3 centered at 0° (12 o'clock)

function mod(n: number, m: number): number {
	return ((n % m) + m) % m
}

export function SpaceOrbBar({
	spaces,
	activeSpaceId,
	expanded,
	onToggleExpanded,
	onSelectSpace,
}: SpaceOrbBarProps) {
	const visibleSpaces = spaces.slice(0, MAX_FREE_SPACES_PER_REALM)
	const count = visibleSpaces.length
	const activeIndex = Math.max(
		0,
		visibleSpaces.findIndex((s) => s.id === activeSpaceId)
	)
	const activeSpace = visibleSpaces[activeIndex] || visibleSpaces[0]

	// Continuous unbounded slot position for true infinite modulo-wrapping rotation
	const [dialPos, setDialPos] = useState<number>(activeIndex)
	const [isDragging, setIsDragging] = useState(false)

	const dialPosRef = useRef<number>(activeIndex)
	const dragRef = useRef<{
		pointerId: number
		startX: number
		startPos: number
		lastX: number
		lastTime: number
		velocityPxPerMs: number
	} | null>(null)
	const wheelAccumRef = useRef<number>(0)
	const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const dialStageRef = useRef<HTMLDivElement>(null)

	// Keep ref synced with state
	dialPosRef.current = dialPos

	// Reset drag state if dial collapses or becomes inactive mid-drag
	useEffect(() => {
		if (!expanded || count <= 1) {
			dragRef.current = null
			setIsDragging(false)
		}
	}, [expanded, count])

	// Sync dial position when activeSpaceId changes externally (e.g. realm switch or drawer select)
	useEffect(() => {
		if (count <= 1 || isDragging) return
		const currentMod = mod(Math.round(dialPosRef.current), count)
		if (currentMod === activeIndex) return

		// Find shortest circular distance to the new activeIndex
		let diff = activeIndex - currentMod
		if (diff > count / 2) diff -= count
		if (diff < -count / 2) diff += count
		const nextPos = Math.round(dialPosRef.current) + diff
		dialPosRef.current = nextPos
		setDialPos(nextPos)
	}, [activeIndex, count, isDragging])

	const commitSlot = useCallback(
		(targetSlot: number) => {
			if (count <= 1) return
			dialPosRef.current = targetSlot
			setDialPos(targetSlot)
			const landedSpace = visibleSpaces[mod(targetSlot, count)]
			if (landedSpace && landedSpace.id !== activeSpaceId) {
				hapticTap()
				onSelectSpace(landedSpace.id)
			}
		},
		[activeSpaceId, count, onSelectSpace, visibleSpaces]
	)

	// Non-passive wheel listener so vertical/horizontal wheel smoothly steps the dial without page scroll
	useEffect(() => {
		const el = dialStageRef.current
		if (!el || !expanded || count <= 1) return

		const onWheel = (e: WheelEvent) => {
			const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
			if (Math.abs(primaryDelta) < 1) return
			e.preventDefault()

			wheelAccumRef.current += primaryDelta
			const threshold = 42
			if (Math.abs(wheelAccumRef.current) >= threshold) {
				const step = wheelAccumRef.current > 0 ? 1 : -1
				wheelAccumRef.current = 0
				const nextSlot = Math.round(dialPosRef.current) + step
				commitSlot(nextSlot)
			}

			if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
			wheelResetTimerRef.current = setTimeout(() => {
				wheelAccumRef.current = 0
			}, 160)
		}

		el.addEventListener('wheel', onWheel, { passive: false })
		return () => {
			el.removeEventListener('wheel', onWheel)
			if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
		}
	}, [commitSlot, count, expanded])

	if (count <= 1) return null

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0 && e.pointerType === 'mouse') return
		e.currentTarget.setPointerCapture(e.pointerId)
		const now = performance.now()
		dragRef.current = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startPos: dialPosRef.current,
			lastX: e.clientX,
			lastTime: now,
			velocityPxPerMs: 0,
		}
		setIsDragging(true)
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== e.pointerId) return

		const now = performance.now()
		const dt = Math.max(1, now - drag.lastTime)
		const stepDx = e.clientX - drag.lastX
		drag.velocityPxPerMs = stepDx / dt
		drag.lastX = e.clientX
		drag.lastTime = now

		const totalDx = e.clientX - drag.startX
		// Dragging left (dx < 0) advances clockwise-incoming right orb to 12 o'clock
		const nextPos = drag.startPos - totalDx / PX_PER_SLOT
		dialPosRef.current = nextPos
		setDialPos(nextPos)
	}

	const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== e.pointerId) return
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
		}

		let targetSlot = Math.round(dialPosRef.current)
		// Gentle flick nudge if user flicked quickly without crossing the midpoint
		if (targetSlot === Math.round(drag.startPos) && Math.abs(drag.velocityPxPerMs) > 0.25) {
			targetSlot += drag.velocityPxPerMs < 0 ? 1 : -1
		}

		dragRef.current = null
		setIsDragging(false)
		commitSlot(targetSlot)
	}

	const centerSlot = Math.round(dialPos)
	const slots: number[] = []
	for (let k = -VISIBLE_HALF_SLOTS; k <= VISIBLE_HALF_SLOTS; k++) {
		slots.push(centerSlot + k)
	}

	// Live preview of whichever space is currently closest to 12 o'clock
	const centeredSpace = visibleSpaces[mod(centerSlot, count)] || activeSpace

	return (
		<div
			data-no-pane-swipe="true"
			className="px-4 pt-1 pb-1.5 flex flex-col items-center select-none"
		>
			{/* Minimal Collapsible Toggle Handle (No pill badge clutter) */}
			<button
				type="button"
				onClick={() => {
					hapticTap()
					onToggleExpanded()
				}}
				className="group flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-[#2a241f]/70 text-[13px] text-[#e5ebcd] transition cursor-pointer"
			>
				<span className="w-2 h-2 rounded-full bg-[#cedb9c]" />
				<span className="font-semibold text-[#edf3d2]">{centeredSpace?.name}</span>
				<svg
					className={`w-3.5 h-3.5 text-[#9e998c] transition-transform duration-200 ${
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

			{/* Infinite Rotary Telephone-Dial Carousel */}
			{expanded && (
				<div
					ref={dialStageRef}
					data-no-pane-swipe="true"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={finishDrag}
					onPointerCancel={finishDrag}
					className={`relative w-full max-w-md h-[126px] mt-1 overflow-hidden touch-none ${
						isDragging ? 'cursor-grabbing' : 'cursor-grab'
					}`}
					aria-label="Space rotary dial. Swipe left or right to switch spaces."
				>
					{/* Orbs positioned on invisible circular arc R = 220px, 22° spacing, centered at 12 o'clock */}
					{slots.map((slotIdx) => {
						const space = visibleSpaces[mod(slotIdx, count)]
						const delta = slotIdx - dialPos
						const angleDeg = delta * STEP_DEG
						const angleRad = (angleDeg * Math.PI) / 180
						const x = DIAL_RADIUS * Math.sin(angleRad)
						const y = DIAL_RADIUS * (1 - Math.cos(angleRad))

						const dist = Math.abs(delta)
						const isCenter = dist < 0.45
						const scale = Math.max(0.72, 1.12 - dist * 0.14)
						const opacity = Math.max(0, Math.min(1, 1.08 - dist * 0.3))
						const label = formatOrbLabel(space.name)

						return (
							<div
								key={slotIdx}
								aria-hidden={!isCenter}
								style={{
									transform: `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
									opacity: Number(opacity.toFixed(3)),
									zIndex: Math.round(20 - dist * 4),
								}}
								className={`pointer-events-none absolute left-1/2 top-[38px] flex flex-col items-center ${
									isDragging ? '' : 'transition-[transform,opacity] duration-300 ease-out'
								}`}
							>
								<div
									className={`relative w-12 h-12 rounded-full flex items-center justify-center font-semibold text-[#edf3d2] transition-colors duration-200 ${
										isCenter
											? 'bg-[#0f1f19] text-[12px] ring-2 ring-[#cedb9c] ring-offset-2 ring-offset-[#050a08] shadow-lg shadow-black/50'
											: `bg-gradient-to-br ${space.orbGradient} text-[11px]`
									}`}
								>
									<span>{label}</span>
									{space.unread && !isCenter ? (
										<span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#cedb9c] ring-2 ring-[#050a08]" />
									) : null}
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
