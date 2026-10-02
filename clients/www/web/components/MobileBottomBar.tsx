import React, { useState } from 'react'
import { LiquidLens } from './LiquidLens'

export interface MobileBottomBarProps {
	className?: string
}

export function MobileBottomBar({ className = '' }: MobileBottomBarProps) {
	const [isReloading, setIsReloading] = useState(false)

	const handleBack = () => {
		if (typeof window !== 'undefined') {
			if (window.history.length > 1) {
				window.history.back()
			} else {
				window.scrollTo({ top: 0, behavior: 'smooth' })
			}
		}
	}

	const handleReload = () => {
		setIsReloading(true)
		if (typeof window !== 'undefined') {
			setTimeout(() => {
				window.location.reload()
			}, 250)
		}
	}

	const handleHome = (e: React.MouseEvent) => {
		e.preventDefault()
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' })
			if (window.location.hash) {
				window.history.pushState(null, '', window.location.pathname)
			}
		}
	}

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault()
		if (typeof document !== 'undefined') {
			const el = document.getElementById('get-started')
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' })
			} else {
				window.location.hash = '#get-started'
			}
		}
	}

	const handleContact = (e: React.MouseEvent) => {
		e.preventDefault()
		if (typeof document !== 'undefined') {
			const el = document.getElementById('contact')
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' })
			} else {
				window.location.hash = '#contact'
			}
		}
	}

	return (
		<>
			{/* Bottom Scroll Mask Overlay (Fades out content smoothly underneath the dock) */}
			<div
				className="md:hidden fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-40 bg-gradient-to-t from-black via-black/80 to-transparent backdrop-blur-[6px]"
				style={{
					maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
					WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
				}}
			/>

			{/* Floating Mobile Bottom Navigation Bar (Centered Liquid-Glass Dock) */}
			<div className={`md:hidden fixed bottom-[3.5%] sm:bottom-6 left-4 right-4 z-50 flex items-center justify-center max-w-sm mx-auto pointer-events-auto ${className}`}>
				<LiquidLens className="h-14 w-full rounded-full flex items-center justify-between px-3 shadow-2xl">
					{/* 1. Back Button (Far Left) */}
					<button
						type="button"
						onClick={handleBack}
						className="size-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
						aria-label="Back"
						title="Back"
					>
						<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
							<path d="M19 12H5" />
							<path d="m12 19-7-7 7-7" />
						</svg>
					</button>

					{/* 2. Reload Button (After Back Button) */}
					<button
						type="button"
						onClick={handleReload}
						className="size-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
						aria-label="Reload page"
						title="Reload"
					>
						<svg
							className={`size-5 transition-transform duration-500 ${isReloading ? 'rotate-180 animate-spin' : ''}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.25"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
							<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
							<path d="M16 21h5v-5" />
						</svg>
					</button>

					{/* 3. Logo at Center (Always Takes Home) */}
					<button
						type="button"
						onClick={handleHome}
						className="size-11 sm:size-12 rounded-full flex items-center justify-center bg-white/10 border border-white/25 hover:border-purple-400/60 shadow-lg shadow-purple-950/40 active:scale-95 transition-all cursor-pointer group"
						aria-label="Concord Home"
						title="Home"
					>
						<svg className="size-6 text-[#a855f7] group-hover:scale-105 group-active:scale-95 transition-transform" viewBox="0 0 100 100" fill="none">
							<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
							<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
						</svg>
					</button>

					{/* 4. Download Button (At the Right) */}
					<a
						href="#get-started"
						onClick={handleDownload}
						className="size-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
						aria-label="Download Concord"
						title="Download"
					>
						<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" x2="12" y1="15" y2="3" />
						</svg>
					</a>

					{/* 5. Contact Us Button (To the Far Right) */}
					<a
						href="#contact"
						onClick={handleContact}
						className="size-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
						aria-label="Contact Us"
						title="Contact Us"
					>
						<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
					</a>
				</LiquidLens>
			</div>
		</>
	)
}
