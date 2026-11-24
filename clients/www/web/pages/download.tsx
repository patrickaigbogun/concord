import React, { useEffect, useState } from 'react'
import { LiquidLens } from '../components/LiquidLens'
import { MobileBottomBar } from '../components/MobileBottomBar'

export const metadata = {
	title: 'Download Concord — Communication for people who think in words',
	description: 'Download Concord for Android, macOS, Windows, Linux, and iOS.',
}

type PlatformId = 'android' | 'ios' | 'macos' | 'windows' | 'linux'

interface PlatformOption {
	id: PlatformId
	name: string
	tagline: string
	requirement: string
	fileLabel: string
	sizeLabel?: string
	available: boolean
	downloadUrl?: string
	accentBg: string
}

const APK_URL =
	'https://github.com/patrickaigbogun/concord/releases/download/latest-android/concord-android-arm64.apk'
const RELEASES_URL = 'https://github.com/patrickaigbogun/concord/releases/tag/latest-android'

const PLATFORMS: PlatformOption[] = [
	{
		id: 'android',
		name: 'Android',
		tagline: 'Native arm64 client with spatial swipe navigation, Realm Note audio, and voice notes.',
		requirement: 'Android 9.0+ (arm64-v8a)',
		fileLabel: 'concord-android-arm64.apk',
		sizeLabel: '6.6 MB',
		available: true,
		downloadUrl: APK_URL,
		accentBg: '#4c1d95',
	},
	{
		id: 'macos',
		name: 'macOS',
		tagline: 'Lightweight native desktop client powered by Tauri with Concord ID deep-linking.',
		requirement: 'macOS 12+ (Apple Silicon & Intel)',
		fileLabel: 'Concord.dmg',
		available: false,
		accentBg: '#141414',
	},
	{
		id: 'windows',
		name: 'Windows',
		tagline: 'Fast native Windows installer built for long writing sessions and low memory use.',
		requirement: 'Windows 10 / 11 (x64)',
		fileLabel: 'Concord-Setup.exe',
		available: false,
		accentBg: '#141414',
	},
	{
		id: 'linux',
		name: 'Linux',
		tagline: 'Clean AppImage and .deb packages for modern Linux desktops.',
		requirement: 'Ubuntu / Debian / Fedora (x64 & arm64)',
		fileLabel: 'Concord.AppImage',
		available: false,
		accentBg: '#141414',
	},
	{
		id: 'ios',
		name: 'iOS',
		tagline: 'Native iPhone and iPad client arriving on TestFlight.',
		requirement: 'iOS 15+',
		fileLabel: 'TestFlight Beta',
		available: false,
		accentBg: '#141414',
	},
]

function detectUserPlatform(): PlatformId {
	if (typeof navigator === 'undefined') return 'android'

	const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
	const platformHint = (uaData?.platform || navigator.platform || '').toLowerCase()
	const ua = (navigator.userAgent || '').toLowerCase()

	if (/android/.test(ua) || /android/.test(platformHint)) return 'android'
	if (/iphone|ipad|ipod/.test(ua) || (/mac/.test(platformHint) && navigator.maxTouchPoints > 1)) {
		return 'ios'
	}
	if (/mac/.test(platformHint) || /macintosh|mac os x/.test(ua)) return 'macos'
	if (/win/.test(platformHint) || /windows/.test(ua)) return 'windows'
	if (/linux/.test(platformHint) || /linux/.test(ua)) return 'linux'
	return 'android'
}

function PlatformIcon({ id, className = 'w-6 h-6' }: { id: PlatformId; className?: string }) {
	switch (id) {
		case 'android':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
					<rect x="5" y="9" width="14" height="10" rx="2" />
					<path d="M8 9V7a4 4 0 0 1 8 0v2" />
					<path d="M9 3.5 10.2 5.2" />
					<path d="M15 3.5 13.8 5.2" />
					<circle cx="10" cy="13.5" r="0.8" fill="currentColor" />
					<circle cx="14" cy="13.5" r="0.8" fill="currentColor" />
				</svg>
			)
		case 'ios':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
					<rect x="6" y="2.5" width="12" height="19" rx="3" />
					<line x1="10" y1="18" x2="14" y2="18" />
				</svg>
			)
		case 'macos':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path d="M2 20h20" />
				</svg>
			)
		case 'windows':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="3" width="8" height="8" rx="1" />
					<rect x="13" y="3" width="8" height="8" rx="1" />
					<rect x="3" y="13" width="8" height="8" rx="1" />
					<rect x="13" y="13" width="8" height="8" rx="1" />
				</svg>
			)
		case 'linux':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="4 17 10 11 4 5" />
					<line x1="12" y1="19" x2="20" y2="19" />
				</svg>
			)
	}
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	)
}

export default function DownloadPage() {
	const [detected, setDetected] = useState<PlatformId | null>(null)
	const [selectedId, setSelectedId] = useState<PlatformId | null>(null)

	useEffect(() => {
		const os = detectUserPlatform()
		setDetected(os)
		setSelectedId(os)
	}, [])

	const activeId: PlatformId = selectedId || detected || 'android'
	const highlighted = PLATFORMS.find((p) => p.id === activeId) || PLATFORMS[0]
	const otherPlatforms = PLATFORMS.filter((p) => p.id !== highlighted.id)
	const isAutoMatched = detected !== null && detected === highlighted.id

	return (
		<div className="min-h-screen w-full bg-black text-white selection:bg-white selection:text-black">
			{/* Floating 3-Part Pill Navigation (Exact Landing Page Chrome) */}
			<header className="hidden md:block fixed top-4 sm:top-6 left-0 right-0 z-50 pointer-events-none px-4 sm:px-8 lg:px-12">
				<div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
					<LiquidLens className="rounded-full px-5 py-2.5 sm:px-6 sm:py-3 pointer-events-auto">
						<a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
							<svg className="w-7 h-7 text-[#7c3aed]" viewBox="0 0 100 100" fill="none">
								<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
								<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
							</svg>
							<span className="font-bold tracking-tight text-lg sm:text-xl text-white font-heading">Concord</span>
						</a>
					</LiquidLens>

					<LiquidLens className="hidden md:flex rounded-full px-8 py-3 pointer-events-auto">
						<nav className="flex items-center gap-8 text-sm sm:text-base text-neutral-300 font-semibold">
							<a href="/#features" className="hover:text-white transition-colors">Chat &amp; Posts</a>
							<a href="/#spaces" className="hover:text-white transition-colors">Spaces &amp; Realms</a>
							<a href="/download" className="text-white transition-colors">Download</a>
						</nav>
					</LiquidLens>

					<LiquidLens className="hidden md:flex rounded-full p-1.5 sm:p-2 items-center gap-2 pointer-events-auto">
						<a
							href="/app"
							className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
						>
							Log In
						</a>
						<a
							href="/app"
							className="px-5 sm:px-6 py-2 sm:py-2.5 text-sm font-bold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm"
						>
							Open App
						</a>
					</LiquidLens>
				</div>
			</header>

			{/* Section 1: Hero — Generous Widescreen Side-by-Side Layout Matching Landing */}
			<section className="w-full flex flex-col justify-center items-center px-6 sm:px-10 lg:px-16 pt-14 md:pt-36 pb-20">
				{/* Mobile Brand Bar */}
				<div className="max-w-[1720px] w-full flex md:hidden items-center justify-between mb-10">
					<a href="/" className="flex items-center gap-2.5">
						<svg className="w-7 h-7 text-[#7c3aed]" viewBox="0 0 100 100" fill="none">
							<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
							<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
						</svg>
						<span className="font-bold tracking-tight text-lg text-white font-heading">Concord</span>
					</a>
					<a
						href="/app"
						className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs"
					>
						Open App
					</a>
				</div>

				<div className="max-w-[1720px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center">
					{/* Left Column: Editorial Headline + Primary Device CTA */}
					<div className="lg:col-span-5 space-y-7 text-left">
						<div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#141414] border border-[#2e2e2e] text-xs font-bold text-neutral-200">
							<span className="w-2 h-2 rounded-full bg-emerald-400" />
							<span>
								{detected ? `Detected ${PLATFORMS.find((p) => p.id === detected)?.name} device` : 'Desktop & Mobile'}
							</span>
						</div>

						<h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold tracking-tight text-white leading-[1.08] font-heading">
							Concord on every device you write on.
						</h1>

						<p className="text-xl sm:text-2xl text-neutral-300 font-semibold leading-relaxed max-w-2xl">
							Fast native clients built with Tauri. Sovereign Spaces, federated Realms, and longform posts with zero bloat.
						</p>

						<div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
							{highlighted.available && highlighted.downloadUrl ? (
								<a
									href={highlighted.downloadUrl}
									className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full bg-white text-black font-bold text-sm sm:text-lg hover:bg-neutral-200 transition-colors whitespace-nowrap"
								>
									<DownloadIcon className="w-4 h-4 sm:w-5 sm:h-5" />
									<span>Download for {highlighted.name}</span>
								</a>
							) : (
								<a
									href="/app"
									className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full bg-white text-black font-bold text-sm sm:text-lg hover:bg-neutral-200 transition-colors whitespace-nowrap"
								>
									<span>Open in Browser</span>
								</a>
							)}

							<a
								href={highlighted.available ? '/app' : APK_URL}
								className="inline-flex items-center justify-center gap-2 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full border border-[#2e2e2e] text-white font-bold text-sm sm:text-lg hover:bg-neutral-900 transition-colors whitespace-nowrap"
							>
								<span>{highlighted.available ? 'Open Web App' : 'Get Android APK'}</span>
							</a>
						</div>
					</div>

					{/* Right Column: Concord Window Showcase for Auto-Detected / Selected Platform */}
					<div className="lg:col-span-7 w-full">
						<div className="w-full rounded-2xl border border-[#2e2e2e] bg-[#0c0c0c] overflow-hidden text-left">
							{/* Window Title Bar (Matches Landing Hero Window) */}
							<div className="px-4 py-3.5 bg-[#141414] border-b border-[#222222] flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
									<div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
									<div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
									<span className="ml-3 text-sm text-neutral-300 font-semibold truncate">
										Concord — {highlighted.name} Release
									</span>
								</div>
								<div className="flex items-center gap-2 text-xs sm:text-sm font-bold shrink-0">
									<span className={`w-2.5 h-2.5 rounded-full ${highlighted.available ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
									<span className={highlighted.available ? 'text-emerald-400' : 'text-neutral-400'}>
										{highlighted.available ? 'Ready' : 'Coming Soon'}
									</span>
								</div>
							</div>

							{/* Highlighted Platform Body */}
							<div className="p-6 sm:p-8 lg:p-10 space-y-8 bg-[#0a0a0a]">
								<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
									<div className="flex items-start gap-4">
										<div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#2e2e2e] flex items-center justify-center text-white shrink-0">
											<PlatformIcon id={highlighted.id} className="w-7 h-7" />
										</div>
										<div className="space-y-1.5">
											<div className="flex items-center gap-2.5 flex-wrap">
												<h2 className="text-2xl sm:text-3xl font-bold text-white font-heading tracking-tight">
													Concord for {highlighted.name}
												</h2>
												{isAutoMatched && (
													<span className="text-xs font-bold px-3 py-1 rounded-full bg-[#7c3aed] text-white">
														Your Device
													</span>
												)}
											</div>
											<p className="text-sm text-neutral-400 font-semibold">
												{highlighted.requirement}
											</p>
										</div>
									</div>

									{highlighted.sizeLabel && (
										<div className="px-3.5 py-2 rounded-xl bg-[#141414] border border-[#222222] text-left sm:text-right shrink-0">
											<div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">Package Size</div>
											<div className="text-sm font-bold text-white">{highlighted.sizeLabel}</div>
										</div>
									)}
								</div>

								<p className="text-base sm:text-lg text-neutral-200 font-semibold leading-relaxed">
									{highlighted.tagline}
								</p>

								{/* Package Metadata Bar */}
								<div className="p-4 rounded-xl bg-[#141414] border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
									<div className="space-y-0.5 min-w-0">
										<div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">
											Build Artifact
										</div>
										<div className="text-sm font-mono font-semibold text-neutral-200 truncate">
											{highlighted.fileLabel}
										</div>
									</div>

									{highlighted.available && highlighted.downloadUrl ? (
										<a
											href={highlighted.downloadUrl}
											className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-neutral-200 text-sm font-bold transition-colors shrink-0"
										>
											<DownloadIcon className="w-4 h-4" />
											<span>Download APK</span>
										</a>
									) : (
										<span className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-[#2e2e2e] text-neutral-400 text-xs font-bold shrink-0">
											In Development
										</span>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Section 2: All Platforms Grid (Flat Monochrome Cards Matching Landing) */}
			<section className="w-full px-6 sm:px-10 lg:px-16 py-16 border-t border-[#1f1f1f]">
				<div className="max-w-[1720px] mx-auto space-y-8">
					<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
						<div className="space-y-2">
							<div className="text-xs uppercase tracking-widest text-[#7c3aed] font-bold">
								All Platforms
							</div>
							<h3 className="text-2xl sm:text-4xl font-bold text-white font-heading tracking-tight">
								Choose your system
							</h3>
						</div>
						<a
							href={RELEASES_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm font-bold text-neutral-300 hover:text-white transition-colors"
						>
							All GitHub Releases
						</a>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
						{otherPlatforms.map((platform) => {
							const isDetectedCard = detected === platform.id
							return (
								<div
									key={platform.id}
									onClick={() => setSelectedId(platform.id)}
									className={`rounded-2xl border p-6 flex flex-col justify-between gap-6 transition-colors cursor-pointer bg-[#0a0a0a] hover:bg-[#121212] ${
										isDetectedCard ? 'border-white' : 'border-[#1f1f1f] hover:border-[#2e2e2e]'
									}`}
								>
									<div className="space-y-4">
										<div className="flex items-center justify-between gap-3">
											<div className="w-11 h-11 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
												<PlatformIcon id={platform.id} className="w-5 h-5" />
											</div>
											<span
												className={`text-xs font-bold px-3 py-1 rounded-full border ${
													platform.available
														? 'bg-[#141414] border-emerald-500/40 text-emerald-400'
														: 'bg-[#141414] border-[#222222] text-neutral-400'
												}`}
											>
												{platform.available ? 'Available' : 'Soon'}
											</span>
										</div>

										<div className="space-y-1">
											<div className="text-xl font-bold text-white font-heading">{platform.name}</div>
											<div className="text-xs text-neutral-500 font-semibold">{platform.requirement}</div>
										</div>

										<p className="text-sm text-neutral-300 font-semibold leading-relaxed">
											{platform.tagline}
										</p>
									</div>

									<div className="pt-4 border-t border-[#1f1f1f] flex items-center justify-between gap-3">
										<span className="text-xs font-mono text-neutral-500 truncate">
											{platform.fileLabel}
										</span>
										{platform.available && platform.downloadUrl ? (
											<a
												href={platform.downloadUrl}
												onClick={(e) => e.stopPropagation()}
												className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-colors shrink-0"
											>
												<DownloadIcon className="w-3.5 h-3.5" />
												<span>Get</span>
											</a>
										) : (
											<span className="text-xs font-bold text-neutral-500 shrink-0">
												Coming Soon
											</span>
										)}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			{/* Footer (Matches Landing Page Brand Wordmark) */}
			<footer className="w-full flex flex-col justify-between px-6 sm:px-10 lg:px-16 pt-16 pb-28 md:pb-8 bg-black text-white border-t border-[#1f1f1f]">
				<div className="w-full select-none pointer-events-none">
					<div className="max-w-[1720px] mx-auto w-full text-sm sm:text-base text-neutral-400 font-semibold pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-auto">
						<div>Concord a product of Dexx Systems OSS. all rights reserved 2026</div>
						<a href="/app" className="text-white hover:text-neutral-300 transition-colors">
							Launch Web App
						</a>
					</div>
					<div className="w-full overflow-hidden text-center leading-none">
						<span className="text-[18vw] font-black tracking-tighter text-neutral-900 font-heading block select-none">
							Concord
						</span>
					</div>
				</div>
			</footer>

			<MobileBottomBar />
		</div>
	)
}
