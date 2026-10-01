import React, { useRef, useState, useEffect, useCallback, memo } from 'react'

interface ChapterData {
	id: string
	statement: string
	rightBg: string
	mascotImg: string
	mascotAlt: string
}

const CHAPTERS: ChapterData[] = [
	{
		id: 'dual-modes',
		statement:
			'Traditional platforms force a choice between chaotic ephemeral chat and rigid message boards. Concord gives you low-latency live streams and permanent published posts side by side.',
		rightBg: '#9a3412', // Solid burnt orange / terracotta
		mascotImg: '/assets/images/mascots/fox_fullbody_pure.png',
		mascotAlt: 'Aether Fox mascot',
	},
	{
		id: 'sovereign-spaces',
		statement:
			"Communities should never be tenants locked inside someone else's walled garden. Your Spaces are independent sovereign territories that federate across open decentralized Realms.",
		rightBg: '#4c1d95', // Solid Concord royal purple
		mascotImg: '/assets/images/mascots/monster_fullbody_pure.png',
		mascotAlt: 'Baron Concord mascot',
	},
	{
		id: 'contextual-identity',
		statement:
			'You are never a single flat profile in all circles of your life. Concord gives you distinct contextual personas across your Spaces without juggling disconnected accounts.',
		rightBg: '#0e7490', // Solid deep oceanic cyan
		mascotImg: '/assets/images/mascots/robot_fullbody_pure.png',
		mascotAlt: 'Cortex Sentinel mascot',
	},
]

// Pre-split statements into word tokens
const PREPARED_CHAPTERS = CHAPTERS.map((c) => ({
	...c,
	words: c.statement.split(' '),
}))

/**
 * Calculates word illumination style for word index i.
 * Word lighting sweeps smoothly as wordProgress moves from 0 to 1.
 */
function getWordStyle(i: number, totalWords: number, wordProgress: number): React.CSSProperties {
	if (wordProgress <= 0) {
		return {
			color: 'rgba(255, 255, 255, 0.20)',
			opacity: 0.32,
			textShadow: 'none',
		}
	}
	if (wordProgress >= 1) {
		return {
			color: '#ffffff',
			opacity: 1,
			textShadow: '0 0 24px rgba(255, 255, 255, 0.35)',
		}
	}

	const activePos = wordProgress * (totalWords - 1)
	const diff = activePos - i
	// Sweep window of 1.4 words for smooth incandescent bloom
	const f = Math.max(0, Math.min(1, (diff + 0.7) / 1.4))

	if (f >= 0.98) {
		return {
			color: '#ffffff',
			opacity: 1,
			textShadow: '0 0 24px rgba(255, 255, 255, 0.35)',
		}
	}
	if (f <= 0.02) {
		return {
			color: 'rgba(255, 255, 255, 0.20)',
			opacity: 0.32,
			textShadow: 'none',
		}
	}

	const r = Math.round(70 + (255 - 70) * f)
	const g = Math.round(70 + (255 - 70) * f)
	const b = Math.round(78 + (255 - 78) * f)

	return {
		color: `rgb(${r}, ${g}, ${b})`,
		opacity: 0.32 + 0.68 * f,
		textShadow:
			f > 0.4
				? `0 0 ${Math.round(f * 20)}px rgba(255, 255, 255, ${(f * 0.35).toFixed(2)})`
				: 'none',
	}
}

/**
 * Computes chapter opacity, transform offset, scale, and word illumination progress
 * based on overall scroll progress p in [0, 1].
 * Strictly hides and unmounts previous/subsequent chapters so no text overlaps.
 */
function getChapterState(k: number, p: number) {
	const stepSize = 1 / 3
	const kStart = k * stepSize
	const t = (p - kStart) / stepSize

	// 1. Far before this chapter
	if (t <= -0.15) {
		return {
			opacity: 0,
			translateY: 24,
			scale: 0.94,
			wordProgress: 0,
			visible: false,
		}
	}

	// 2. Transitioning in from previous chapter (-0.15 < t < 0)
	if (t < 0) {
		const tau = (t + 0.15) / 0.15
		const clampedTau = Math.max(0, Math.min(1, tau))
		return {
			opacity: clampedTau,
			translateY: (1 - clampedTau) * 24,
			scale: 0.94 + clampedTau * 0.06,
			wordProgress: 0,
			visible: clampedTau > 0.01,
		}
	}

	// 3. Completely after this chapter (t >= 1.0 for chapters 0 & 1)
	if (k < 2 && t >= 1.0) {
		return {
			opacity: 0,
			translateY: -24,
			scale: 0.94,
			wordProgress: 1,
			visible: false,
		}
	}

	// 4. Word illumination progress between t = 0.04 and t = 0.70
	const wordProgress = Math.max(0, Math.min(1, (t - 0.04) / (0.7 - 0.04)))

	// 5. Active and transitioning out (0.85 < t < 1.0 for chapters 0 & 1)
	if (k < 2 && t > 0.85) {
		const tau = (t - 0.85) / 0.15
		const clampedTau = Math.max(0, Math.min(1, tau))
		const opacity = Math.max(0, Math.min(1, 1 - clampedTau))
		return {
			opacity,
			translateY: -clampedTau * 24,
			scale: 1.0 - clampedTau * 0.06,
			wordProgress: 1,
			visible: opacity > 0.01,
		}
	}

	// 6. Fully active chapter (0 <= t <= 0.85, or final chapter through completion)
	return {
		opacity: 1,
		translateY: 0,
		scale: 1.0,
		wordProgress,
		visible: true,
	}
}

export const ScrollytellingSection = memo(function ScrollytellingSection() {
	const containerRef = useRef<HTMLDivElement>(null)
	const [progress, setProgress] = useState(0)
	const frameRef = useRef<number | null>(null)

	const handleScroll = useCallback(() => {
		if (frameRef.current) return
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null
			if (!containerRef.current) return
			const rect = containerRef.current.getBoundingClientRect()
			const totalScrollableDistance = rect.height - window.innerHeight
			if (totalScrollableDistance <= 0) return

			const rawProgress = -rect.top / totalScrollableDistance
			const clamped = Math.max(0, Math.min(1, rawProgress))
			setProgress(clamped)
		})
	}, [])

	useEffect(() => {
		window.addEventListener('scroll', handleScroll, { passive: true })
		window.addEventListener('resize', handleScroll, { passive: true })
		handleScroll()

		return () => {
			window.removeEventListener('scroll', handleScroll)
			window.removeEventListener('resize', handleScroll)
			if (frameRef.current) cancelAnimationFrame(frameRef.current)
		}
	}, [handleScroll])

	return (
		<section
			id="features"
			ref={containerRef}
			className="relative w-full h-[380vh] bg-black text-white"
		>
			{/* Smooth anchor for #spaces link from navbar/footer */}
			<div id="spaces" className="absolute top-[33%] -translate-y-24 pointer-events-none" />

			{/* Full Viewport Sticky Stage: 100vh, Full Bleed Edge-to-Edge */}
			<div className="sticky top-0 h-screen w-full flex flex-col md:flex-row overflow-hidden select-none">
				{/* ========================================================================= */}
				{/* LEFT HALF (50vw x 100vh on Desktop): Reveal Text Alone (No extra UI)     */}
				{/* ========================================================================= */}
				<div className="w-full md:w-1/2 h-[55vh] md:h-full flex items-center px-6 sm:px-12 lg:px-16 xl:px-24 relative order-2 md:order-1 bg-black overflow-hidden">
					{/* Ghost spacer to dynamically format height naturally without clipping */}
					<div
						aria-hidden="true"
						className="opacity-0 pointer-events-none select-none invisible flex items-center my-auto pr-6 lg:pr-12 w-full"
					>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.2] max-w-xl">
							{PREPARED_CHAPTERS[0].statement}
						</h2>
					</div>

					{/* Layered Reveal Text */}
					{PREPARED_CHAPTERS.map((chapter, idx) => {
						const state = getChapterState(idx, progress)
						if (!state.visible || state.opacity <= 0.001) return null

						return (
							<div
								key={chapter.id}
								className="absolute inset-y-0 left-6 sm:left-12 lg:left-16 xl:left-24 right-6 sm:right-10 md:right-12 lg:right-16 flex items-center will-change-transform overflow-hidden"
								style={{
									opacity: state.opacity,
									transform: `translate3d(0, ${state.translateY}px, 0)`,
									pointerEvents: state.opacity > 0.8 ? 'auto' : 'none',
								}}
							>
								{/* Reveal Statement Text Alone (Words Light Up as User Scrolls) */}
								<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.2] max-w-xl break-words">
									{chapter.words.map((word, wIdx) => {
										const wordStyle = getWordStyle(wIdx, chapter.words.length, state.wordProgress)
										return (
											<span
												key={wIdx}
												className="inline-block mr-[0.25em] transition-all duration-150 ease-out select-none will-change-transform"
												style={wordStyle}
											>
												{word}
											</span>
										)
									})}
								</h2>
							</div>
						)
					})}
				</div>

				{/* ========================================================================= */}
				{/* RIGHT HALF (50vw x 100vh on Desktop): Solid Chapter Color + Noise + Mascot */}
				{/* ========================================================================= */}
				<div className="w-full md:w-1/2 h-[45vh] md:h-full relative order-1 md:order-2 overflow-hidden">
					{PREPARED_CHAPTERS.map((chapter, idx) => {
						const state = getChapterState(idx, progress)
						if (!state.visible || state.opacity <= 0.001) return null

						return (
							<div
								key={chapter.id}
								className="absolute inset-0 w-full h-full flex items-center justify-center p-6 sm:p-10 lg:p-14 will-change-transform overflow-hidden"
								style={{
									backgroundColor: chapter.rightBg,
									opacity: state.opacity,
									pointerEvents: state.opacity > 0.8 ? 'auto' : 'none',
								}}
							>
								{/* Tactile Fine-Grain Noise Texture Overlay */}
								<div
									className="absolute inset-0 w-full h-full pointer-events-none opacity-20 mix-blend-overlay"
									style={{
										backgroundImage: 'url(/assets/images/noise.png)',
										backgroundRepeat: 'repeat',
									}}
									aria-hidden="true"
								/>

								{/* Full Body Character Standing with Gentle Levitation */}
								<div
									className="relative h-full w-full max-w-[460px] flex items-center justify-center will-change-transform z-10"
									style={{
										transform: `translate3d(0, ${state.translateY}px, 0) scale(${state.scale})`,
									}}
								>
									<img
										src={chapter.mascotImg}
										alt={chapter.mascotAlt}
										className="h-full max-h-[38vh] sm:max-h-[50vh] md:max-h-[74vh] lg:max-h-[80vh] w-auto object-contain select-none pointer-events-none drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)] animate-stage-float"
									/>
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
})
