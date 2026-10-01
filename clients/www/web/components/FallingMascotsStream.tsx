import React, { useMemo } from 'react'

interface MascotParticle {
	id: number
	char: string
	left: number
	size: number
	duration: number
	delay: number
	swayDuration: number
	swayDelay: number
	blinkDuration: number
	blinkDelay: number
	opacity: number
}

export function FallingMascotsStream() {
	// Deterministic particle configuration for SSR and hydration consistency
	const particles: MascotParticle[] = useMemo(() => {
		const items: MascotParticle[] = [
			{ id: 1, char: 'robot', left: 4, size: 48, duration: 22, delay: -4, swayDuration: 5.2, swayDelay: -1, blinkDuration: 3.6, blinkDelay: -0.5, opacity: 0.92 },
			{ id: 2, char: 'fox', left: 11, size: 54, duration: 26, delay: -16, swayDuration: 6.4, swayDelay: -3, blinkDuration: 4.2, blinkDelay: -1.8, opacity: 0.95 },
			{ id: 3, char: 'cat', left: 19, size: 46, duration: 20, delay: -9, swayDuration: 4.8, swayDelay: -2, blinkDuration: 3.4, blinkDelay: -0.2, opacity: 0.90 },
			{ id: 4, char: 'alien', left: 27, size: 50, duration: 24, delay: -21, swayDuration: 5.8, swayDelay: -4, blinkDuration: 3.9, blinkDelay: -2.5, opacity: 0.88 },
			{ id: 5, char: 'monster', left: 35, size: 52, duration: 28, delay: -7, swayDuration: 6.8, swayDelay: -1.5, blinkDuration: 4.5, blinkDelay: -3.1, opacity: 0.92 },
			{ id: 6, char: 'bird', left: 43, size: 46, duration: 19, delay: -14, swayDuration: 4.5, swayDelay: -0.5, blinkDuration: 3.2, blinkDelay: -1.2, opacity: 0.90 },
			{ id: 7, char: 'raccoon', left: 51, size: 50, duration: 25, delay: -2, swayDuration: 6.1, swayDelay: -3.5, blinkDuration: 4.0, blinkDelay: -2.1, opacity: 0.94 },
			{ id: 8, char: 'robot', left: 59, size: 48, duration: 23, delay: -18, swayDuration: 5.4, swayDelay: -2.2, blinkDuration: 3.7, blinkDelay: -0.8, opacity: 0.90 },
			{ id: 9, char: 'fox', left: 67, size: 56, duration: 27, delay: -11, swayDuration: 6.6, swayDelay: -4.1, blinkDuration: 4.4, blinkDelay: -1.6, opacity: 0.92 },
			{ id: 10, char: 'cat', left: 74, size: 46, duration: 21, delay: -24, swayDuration: 4.9, swayDelay: -1.8, blinkDuration: 3.5, blinkDelay: -2.9, opacity: 0.95 },
			{ id: 11, char: 'alien', left: 82, size: 52, duration: 26, delay: -6, swayDuration: 5.9, swayDelay: -3.2, blinkDuration: 4.1, blinkDelay: -0.7, opacity: 0.88 },
			{ id: 12, char: 'monster', left: 89, size: 50, duration: 22, delay: -15, swayDuration: 6.2, swayDelay: -2.7, blinkDuration: 3.8, blinkDelay: -2.2, opacity: 0.92 },
			{ id: 13, char: 'bird', left: 95, size: 44, duration: 18, delay: -8, swayDuration: 4.4, swayDelay: -1.1, blinkDuration: 3.1, blinkDelay: -1.4, opacity: 0.90 },
			{ id: 14, char: 'raccoon', left: 15, size: 48, duration: 25, delay: -19, swayDuration: 5.7, swayDelay: -2.8, blinkDuration: 4.3, blinkDelay: -3.4, opacity: 0.90 },
			{ id: 15, char: 'robot', left: 47, size: 46, duration: 29, delay: -12, swayDuration: 6.5, swayDelay: -4.4, blinkDuration: 3.6, blinkDelay: -1.1, opacity: 0.92 },
			{ id: 16, char: 'cat', left: 79, size: 48, duration: 24, delay: -3, swayDuration: 5.1, swayDelay: -0.9, blinkDuration: 3.8, blinkDelay: -2.4, opacity: 0.94 },
		]
		return items
	}, [])

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden z-[1] select-none" aria-hidden="true">
			{particles.map((p) => (
				<div
					key={p.id}
					className="absolute mascot-fall-track"
					style={{
						left: `${p.left}%`,
						width: `${p.size}px`,
						height: `${p.size}px`,
						animationDuration: `${p.duration}s`,
						animationDelay: `${p.delay}s`,
					}}
				>
					{/* Sway container for gentle horizontal lullaby drift */}
					<div
						className="w-full h-full mascot-sway-motion"
						style={{
							animationDuration: `${p.swayDuration}s`,
							animationDelay: `${p.swayDelay}s`,
							opacity: p.opacity,
						}}
					>
						{/* Head container with breathing/mouth pulse and blinking frames */}
						<div
							className="relative w-full h-full mascot-mouth-pulse hover:opacity-100 transition-opacity"
							style={{
								animationDuration: `${p.blinkDuration * 0.9}s`,
							}}
						>
							{/* Open Eye Frame */}
							<img
								src={`/assets/images/heads_3d/${p.char}.png`}
								alt=""
								className="absolute inset-0 w-full h-full object-contain mascot-blink-open pointer-events-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
								style={{
									animationDuration: `${p.blinkDuration}s`,
									animationDelay: `${p.blinkDelay}s`,
								}}
							/>
							{/* Blinking Closed-Eye Frame */}
							<img
								src={`/assets/images/heads_3d/${p.char}_blink.png`}
								alt=""
								className="absolute inset-0 w-full h-full object-contain mascot-blink-closed pointer-events-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
								style={{
									animationDuration: `${p.blinkDuration}s`,
									animationDelay: `${p.blinkDelay}s`,
								}}
							/>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}
