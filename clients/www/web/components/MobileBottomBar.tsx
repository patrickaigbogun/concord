import React, { useState, useEffect } from 'react'
import { LiquidLens } from './LiquidLens'

export interface MobileBottomBarProps {
	className?: string
}

export function MobileBottomBar({ className = '' }: MobileBottomBarProps) {
	const [isMoreOpen, setIsMoreOpen] = useState(false)
	const [activeSection, setActiveSection] = useState<'home' | 'features' | 'spaces' | 'download'>('home')

	// Close menu on hash change or scroll
	useEffect(() => {
		const handleHashChange = () => {
			setIsMoreOpen(false)
		}
		window.addEventListener('hashchange', handleHashChange)
		return () => window.removeEventListener('hashchange', handleHashChange)
	}, [])

	// Update active section based on scroll position
	useEffect(() => {
		const handleScroll = () => {
			const scrollPos = window.scrollY + 200
			const spacesEl = document.getElementById('spaces')
			const featuresEl = document.getElementById('features')
			const downloadEl = document.getElementById('get-started')

			if (downloadEl && scrollPos >= downloadEl.offsetTop) {
				setActiveSection('download')
			} else if (spacesEl && scrollPos >= spacesEl.offsetTop) {
				setActiveSection('spaces')
			} else if (featuresEl && scrollPos >= featuresEl.offsetTop) {
				setActiveSection('features')
			} else {
				setActiveSection('home')
			}
		}

		window.addEventListener('scroll', handleScroll, { passive: true })
		return () => window.removeEventListener('scroll', handleScroll)
	}, [])

	const coreItems = [
		{
			id: 'features',
			label: 'Chat & Posts',
			href: '#features',
			icon: (
				<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			),
		},
		{
			id: 'spaces',
			label: 'Spaces & Realms',
			href: '#spaces',
			icon: (
				<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10" />
					<path d="m4.93 4.93 4.24 4.24" />
					<path d="m14.83 9.17 4.24-4.24" />
					<path d="m14.83 14.83 4.24 4.24" />
					<path d="m9.17 14.83-4.24 4.24" />
				</svg>
			),
		},
		{
			id: 'download',
			label: 'Download App',
			href: '#get-started',
			icon: (
				<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" x2="12" y1="15" y2="3" />
				</svg>
			),
		},
	]

	const moreMenuItems = [
		{
			label: 'Chat & Posts',
			desc: 'Continuous & deliberate',
			href: '#features',
			icon: (
				<svg className="size-5 text-[#7c3aed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			),
		},
		{
			label: 'Spaces & Realms',
			desc: 'Sovereign discussion',
			href: '#spaces',
			icon: (
				<svg className="size-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10" />
					<path d="m4.93 4.93 4.24 4.24" />
					<path d="m14.83 9.17 4.24-4.24" />
					<path d="m14.83 14.83 4.24 4.24" />
					<path d="m9.17 14.83-4.24 4.24" />
				</svg>
			),
		},
		{
			label: 'Dual Modes',
			desc: 'Quiet & fast channels',
			href: '#features',
			icon: (
				<svg className="size-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<rect width="18" height="18" x="3" y="3" rx="2" />
					<path d="M3 9h18" />
					<path d="M9 21V9" />
				</svg>
			),
		},
		{
			label: 'Character Crew',
			desc: 'Meet the mascots',
			href: '#characters',
			icon: (
				<svg className="size-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="8" r="5" />
					<path d="M20 21a8 8 0 0 0-16 0" />
				</svg>
			),
		},
		{
			label: 'Download App',
			desc: 'Desktop & mobile builds',
			href: '#get-started',
			icon: (
				<svg className="size-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" x2="12" y1="15" y2="3" />
				</svg>
			),
		},
		{
			label: 'Manifesto',
			desc: 'Thinking in words',
			href: '#features',
			icon: (
				<svg className="size-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
					<path d="M6 6h10" />
					<path d="M6 10h10" />
				</svg>
			),
		},
	]

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

			{/* Floating Mobile Bottom Navigation Bar (Split Island Dock) */}
			<div className={`md:hidden fixed bottom-[4%] sm:bottom-6 left-4 right-4 z-50 flex items-center justify-between max-w-md mx-auto pointer-events-auto ${className}`}>
				{/* 1. Left Capsule: 3 Core Navigation Items */}
				<LiquidLens className="h-12 rounded-full flex items-center gap-2 px-3 shadow-2xl">
					{coreItems.map((item) => {
						const isActive = activeSection === item.id

						return (
							<a
								key={item.id}
								href={item.href}
								className={`flex items-center justify-center p-2 rounded-full transition-all duration-200 cursor-pointer ${
									isActive
										? 'text-white bg-white/20 shadow-sm'
										: 'text-neutral-400 hover:text-white hover:bg-white/10'
								}`}
								aria-label={item.label}
								title={item.label}
							>
								{item.icon}
							</a>
						)
					})}
				</LiquidLens>

				{/* 2. Right Group: Two Circular Floating Glass Action Buttons */}
				<div className="flex items-center gap-2.5">
					{/* Circular Action Button: Quick Launch / Open App */}
					<LiquidLens className="size-12 rounded-full flex items-center justify-center cursor-pointer shadow-2xl p-0.5">
						<a
							href="#get-started"
							className="size-full rounded-full flex items-center justify-center bg-white/5 hover:bg-white/15 transition-all text-white active:scale-95"
							aria-label="Open Concord App"
							title="Open Concord App"
						>
							<svg className="w-5 h-5 text-[#7c3aed]" viewBox="0 0 100 100" fill="none">
								<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
								<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="12" />
							</svg>
						</a>
					</LiquidLens>

					{/* Circular More Button: 4-Dots / Toggle Drawer */}
					<LiquidLens className="size-12 rounded-full flex items-center justify-center cursor-pointer shadow-2xl p-0.5">
						<button
							type="button"
							onClick={() => setIsMoreOpen(!isMoreOpen)}
							className={`size-full rounded-full flex items-center justify-center transition-all active:scale-95 ${
								isMoreOpen
									? 'bg-white/20 text-white'
									: 'bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white'
							}`}
							aria-label="Toggle Navigation Menu"
							title="More Options"
						>
							{isMoreOpen ? (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							) : (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
									<circle cx="7" cy="7" r="2.2" />
									<circle cx="17" cy="7" r="2.2" />
									<circle cx="7" cy="17" r="2.2" />
									<circle cx="17" cy="17" r="2.2" />
								</svg>
							)}
						</button>
					</LiquidLens>
				</div>
			</div>

			{/* More Menu Backdrop */}
			<div
				onClick={() => setIsMoreOpen(false)}
				className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
					isMoreOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
				}`}
			/>

			{/* Spring-Animated Floating Glass Popover Card */}
			<div
				onClick={(e) => e.stopPropagation()}
				className={`fixed bottom-[calc(4%+4rem)] sm:bottom-[calc(1.5rem+4rem)] left-4 right-4 max-w-sm mx-auto rounded-3xl border border-white/15 bg-neutral-950/90 backdrop-blur-2xl shadow-2xl p-4.5 transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform origin-bottom z-50 md:hidden ${
					isMoreOpen
						? 'scale-100 translate-y-0 opacity-100 pointer-events-auto'
						: 'scale-50 translate-y-16 opacity-0 pointer-events-none'
				}`}
			>
				<div className="space-y-3.5">
					<div className="flex items-center justify-between px-1">
						<span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
							Navigation
						</span>
						<span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
							<span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
							Online
						</span>
					</div>

					{/* 2-Column Grid of Navigation Tiles */}
					<div className="grid grid-cols-2 gap-2">
						{moreMenuItems.map((item) => (
							<a
								key={item.label}
								href={item.href}
								onClick={() => setIsMoreOpen(false)}
								className="flex flex-col items-center justify-center p-3 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 text-neutral-300 hover:text-white transition-all gap-1 text-center group"
							>
								<div className="transition-transform duration-200 group-hover:scale-110">
									{item.icon}
								</div>
								<span className="text-xs font-bold text-white tracking-tight">
									{item.label}
								</span>
								<span className="text-[10px] text-neutral-400 line-clamp-1">
									{item.desc}
								</span>
							</a>
						))}
					</div>

					{/* Bottom Actions Row */}
					<div className="pt-2 border-t border-white/10 flex items-center gap-2">
						<a
							href="#get-started"
							onClick={() => setIsMoreOpen(false)}
							className="flex-1 py-2.5 rounded-full border border-white/15 text-white text-xs font-bold text-center hover:bg-white/10 transition-colors"
						>
							Log In
						</a>
						<a
							href="#get-started"
							onClick={() => setIsMoreOpen(false)}
							className="flex-1 py-2.5 rounded-full bg-white text-black text-xs font-bold text-center hover:bg-neutral-200 transition-colors shadow-sm"
						>
							Open App
						</a>
					</div>
				</div>
			</div>
		</>
	)
}
