import React, { useEffect, useState } from 'react'
import { LiquidLens } from '../components/LiquidLens'
import { MobileBottomBar } from '../components/MobileBottomBar'

export const metadata = {
	title: 'Download Concord — Desktop & Mobile',
	description: 'Download Concord for Android, macOS, Windows, Linux, and iOS. Sovereign Spaces and federated Realms everywhere you write.',
}

type PlatformId = 'android' | 'ios' | 'macos' | 'windows' | 'linux'

interface PlatformOption {
	id: PlatformId
	name: string
	tagline: string
	requirement: string
	fileLabel: string
	available: boolean
	downloadUrl?: string
	badge?: string
}

const APK_URL =
	'https://github.com/patrickaigbogun/concord/releases/download/latest-android/concord-android-arm64.apk'
const RELEASES_URL = 'https://github.com/patrickaigbogun/concord/releases/tag/latest-android'

const PLATFORMS: PlatformOption[] = [
	{
		id: 'android',
		name: 'Android',
		tagline: 'Native arm64 app with spatial swipe navigation & voice notes.',
		requirement: 'Android 9.0+ (arm64-v8a)',
		fileLabel: 'concord-android-arm64.apk',
		available: true,
		downloadUrl: APK_URL,
		badge: 'Available Now',
	},
	{
		id: 'macos',
		name: 'macOS',
		tagline: 'Lightweight native desktop client powered by Tauri.',
		requirement: 'macOS 12+ (Apple Silicon & Intel)',
		fileLabel: 'Concord.dmg',
		available: false,
		badge: 'Coming Soon',
	},
	{
		id: 'windows',
		name: 'Windows',
		tagline: 'Fast native Windows installer with Concord ID deep-linking.',
		requirement: 'Windows 10 / 11 (x64)',
		fileLabel: 'Concord-Setup.exe',
		available: false,
		badge: 'Coming Soon',
	},
	{
		id: 'linux',
		name: 'Linux',
		tagline: 'Clean AppImage & .deb builds for modern Linux desktops.',
		requirement: 'Ubuntu / Debian / Fedora (x64 & arm64)',
		fileLabel: 'Concord.AppImage',
		available: false,
		badge: 'Coming Soon',
	},
	{
		id: 'ios',
		name: 'iOS',
		tagline: 'Native iPhone & iPad client coming to TestFlight.',
		requirement: 'iOS 15+',
		fileLabel: 'TestFlight Beta',
		available: false,
		badge: 'Coming Soon',
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
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
					<rect x="6" y="2.5" width="12" height="19" rx="3" />
					<line x1="10" y1="18" x2="14" y2="18" />
				</svg>
			)
		case 'macos':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path d="M2 20h20" />
				</svg>
			)
		case 'windows':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="3" width="8" height="8" rx="1" />
					<rect x="13" y="3" width="8" height="8" rx="1" />
					<rect x="3" y="13" width="8" height="8" rx="1" />
					<rect x="13" y="13" width="8" height="8" rx="1" />
				</svg>
			)
		case 'linux':
			return (
				<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="4 17 10 11 4 5" />
					<line x1="12" y1="19" x2="20" y2="19" />
				</svg>
			)
	}
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	)
}

export default function DownloadPage() {
	const [detected, setDetected] = useState<PlatformId | null>(null)

	useEffect(() => {
		setDetected(detectUserPlatform())
	}, [])

	const activeId: PlatformId = detected || 'android'
	const highlighted = PLATFORMS.find((p) => p.id === activeId) || PLATFORMS[0]
	const otherPlatforms = PLATFORMS.filter((p) => p.id !== highlighted.id)

	return (
		<div className="min-h-screen w-full bg-black text-white selection:bg-white selection:text-black pb-28 md:pb-16">
			{/* Floating Navigation */}
			<header className="hidden md:block fixed top-4 sm:top-6 left-0 right-0 z-50 pointer-events-none px-4 sm:px-8 lg:px-12">
				<div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
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
							href="https://id.dexx.systems"
							className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
						>
							Concord ID
						</a>
						<a
							href={APK_URL}
							className="px-5 py-2 text-sm font-bold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm"
						>
							Get Android APK
						</a>
					</LiquidLens>
				</div>
			</header>

			<main className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 md:pt-36 space-y-12">
				{/* Mobile Brand Header */}
				<div className="flex md:hidden items-center justify-between">
					<a href="/" className="flex items-center gap-2.5">
						<svg className="w-7 h-7 text-[#7c3aed]" viewBox="0 0 100 100" fill="none">
							<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
							<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
						</svg>
						<span className="font-bold tracking-tight text-lg text-white font-heading">Concord</span>
					</a>
					<a
						href="/"
						className="text-xs font-semibold text-neutral-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10"
					>
						Home
					</a>
				</div>

				{/* Hero */}
				<div className="space-y-4 text-left sm:text-center max-w-2xl sm:mx-auto">
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#7c3aed]/15 border border-[#7c3aed]/35 text-xs font-semibold text-[#c4b5fd]">
						<span className="w-2 h-2 rounded-full bg-[#a78bfa]" />
						<span>{detected ? `Detected ${highlighted.name} on your device` : 'Native Desktop & Mobile'}</span>
					</div>
					<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-heading leading-[1.08]">
						Download Concord.
					</h1>
					<p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
						Sovereign Spaces, federated Realms, and long-form Series — built natively with Tauri for speed and quiet focus.
					</p>
				</div>

				{/* Highlighted Auto-Detected Device Card */}
				<section className="relative rounded-3xl border border-[#7c3aed]/55 bg-gradient-to-br from-[#7c3aed]/15 via-[#111116] to-[#0a0a0d] p-6 sm:p-8 shadow-2xl shadow-[#7c3aed]/15 overflow-hidden">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/40 flex items-center justify-center text-[#c4b5fd]">
									<PlatformIcon id={highlighted.id} className="w-6 h-6" />
								</div>
								<div>
									<div className="flex items-center gap-2 flex-wrap">
										<h2 className="text-2xl font-bold text-white tracking-tight">
											Concord for {highlighted.name}
										</h2>
										<span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#7c3aed] text-white">
											Recommended for your device
										</span>
									</div>
									<p className="text-xs text-neutral-400 mt-0.5">{highlighted.requirement}</p>
								</div>
							</div>
							<p className="text-sm text-neutral-300 max-w-xl leading-relaxed">
								{highlighted.tagline}
							</p>
						</div>

						<div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
							{highlighted.available && highlighted.downloadUrl ? (
								<>
									<a
										href={highlighted.downloadUrl}
										className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold text-sm transition shadow-lg"
									>
										<DownloadIcon className="w-4 h-4" />
										<span>Download for {highlighted.name}</span>
									</a>
									<span className="text-[11px] font-mono text-neutral-400 text-center sm:text-right">
										{highlighted.fileLabel}
									</span>
								</>
							) : (
								<>
									<div className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-neutral-200 font-semibold text-sm">
										<span>{highlighted.name} Build Coming Soon</span>
									</div>
									<a
										href={APK_URL}
										className="text-xs text-[#c4b5fd] hover:text-white underline underline-offset-4 text-center sm:text-right"
									>
										Download Android APK now
									</a>
								</>
							)}
						</div>
					</div>
				</section>

				{/* All Other Platforms Grid */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-xs uppercase tracking-widest font-bold text-neutral-500">
							Other Platforms
						</h3>
						<a
							href={RELEASES_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition"
						>
							View GitHub Releases
						</a>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{otherPlatforms.map((platform) => (
							<div
								key={platform.id}
								className="rounded-2xl border border-white/[0.08] bg-[#0e0e12] hover:border-white/20 p-5 flex flex-col justify-between gap-5 transition"
							>
								<div className="space-y-2.5">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-neutral-300">
												<PlatformIcon id={platform.id} className="w-5 h-5" />
											</div>
											<div>
												<div className="text-base font-bold text-white">{platform.name}</div>
												<div className="text-[11px] text-neutral-500">{platform.requirement}</div>
											</div>
										</div>
										<span
											className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
												platform.available
													? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
													: 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
											}`}
										>
											{platform.badge}
										</span>
									</div>
									<p className="text-xs text-neutral-400 leading-relaxed">{platform.tagline}</p>
								</div>

								<div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
									<span className="text-[11px] font-mono text-neutral-500 truncate">
										{platform.fileLabel}
									</span>
									{platform.available && platform.downloadUrl ? (
										<a
											href={platform.downloadUrl}
											className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shrink-0"
										>
											<DownloadIcon className="w-3.5 h-3.5" />
											<span>Download</span>
										</a>
									) : (
										<span className="text-xs font-semibold text-neutral-500 shrink-0">
											In Progress
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</section>
			</main>

			<MobileBottomBar />
		</div>
	)
}
