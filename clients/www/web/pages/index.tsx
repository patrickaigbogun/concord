import React, { useState } from 'react'
import { LiquidLens } from '../components/LiquidLens'
import { GradualBlur } from '../components/GradualBlur'
import { ScrollytellingSection } from '../components/ScrollytellingSection'

export const metadata = {
	title: 'Concord — Communication for people who think in words',
	description: 'A writing- and discussion-centric platform structured around sovereign Spaces and federated Realms.',
}

export default function LandingPage() {
	const [animationKey, setAnimationKey] = useState(0)

	return (
		<div className="min-h-screen w-full bg-black text-white selection:bg-white selection:text-black">
			{/* Floating 3-Part Pill Navigation */}
			<header className="fixed top-4 sm:top-6 left-0 right-0 z-50 pointer-events-none px-4 sm:px-8 lg:px-12">
				<div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
					{/* Pill 1: Logo Section */}
					<LiquidLens className="rounded-full px-5 py-2.5 sm:px-6 sm:py-3 pointer-events-auto">
						<a href="#" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
							<svg className="w-7 h-7 text-[#7c3aed]" viewBox="0 0 100 100" fill="none">
								<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
								<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
							</svg>
							<span className="font-bold tracking-tight text-lg sm:text-xl text-white font-heading">Concord</span>
						</a>
					</LiquidLens>

					{/* Pill 2: Menu Items */}
					<LiquidLens className="hidden md:flex rounded-full px-8 py-3 pointer-events-auto">
						<nav className="flex items-center gap-8 text-sm sm:text-base text-neutral-300 font-semibold">
							<a href="#features" className="hover:text-white transition-colors">Chat &amp; Posts</a>
							<a href="#spaces" className="hover:text-white transition-colors">Spaces &amp; Realms</a>
							<a href="#get-started" className="hover:text-white transition-colors">Download</a>
						</nav>
					</LiquidLens>

					{/* Pill 3: Buttons on the End */}
					<LiquidLens className="rounded-full p-1.5 sm:p-2 flex items-center gap-2 pointer-events-auto">
						<a
							href="#get-started"
							className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
						>
							Log In
						</a>
						<a
							href="#get-started"
							className="px-5 sm:px-6 py-2 sm:py-2.5 text-sm font-bold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm"
						>
							Open App
						</a>
					</LiquidLens>
				</div>
			</header>

			{/* Section 1: Hero — Generous Widescreen Side-by-Side Layout */}
			<section className="min-h-screen w-full flex flex-col justify-center items-center px-6 sm:px-10 lg:px-16 pt-28 sm:pt-32 pb-16 relative">
				<div className="max-w-[1720px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center">
					{/* Left Column: Hero Text & CTAs */}
					<div className="lg:col-span-5 space-y-7 text-left">
						<h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold tracking-tight text-white leading-[1.08] font-heading">
							Communication for people who think in words.
						</h1>

						<p className="text-xl sm:text-2xl xl:text-3xl text-neutral-200 font-semibold leading-relaxed max-w-3xl">
							Fast continuous conversations and deliberate published posts living together in sovereign Spaces and federated Realms.
						</p>

						<div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 pt-3 w-full">
							<a
								href="#get-started"
								className="flex-1 sm:flex-initial text-center px-4 sm:px-9 py-3.5 sm:py-4.5 rounded-full bg-white text-black font-bold text-sm sm:text-lg hover:bg-neutral-200 transition-colors whitespace-nowrap"
							>
								Get Started Free
							</a>
							<a
								href="#features"
								className="flex-1 sm:flex-initial text-center px-4 sm:px-9 py-3.5 sm:py-4.5 rounded-full border border-[#2e2e2e] text-white font-bold text-sm sm:text-lg hover:bg-neutral-900 transition-colors whitespace-nowrap"
							>
								See How It Works
							</a>
						</div>
					</div>

					{/* Right Column: 3D Cinematic Window Showcase (Expansive 3-Column UI) */}
					<div className="lg:col-span-7 w-full">
						<div
							key={animationKey}
							className="animate-cinematic-reveal w-full rounded-2xl border border-[#2e2e2e] bg-[#0c0c0c] shadow-2xl overflow-hidden text-left"
							style={{ transformOrigin: 'bottom center' }}
						>
							{/* Window Title Bar */}
							<div className="px-4 py-3.5 bg-[#141414] border-b border-[#222222] flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
									<div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
									<div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
									<span className="ml-3 text-sm text-neutral-300 font-semibold hidden sm:inline">
										Concord — Sovereign Spaces &amp; Discussion
									</span>
								</div>
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={() => setAnimationKey((k) => k + 1)}
										className="text-xs font-bold text-neutral-300 hover:text-white px-3 py-1.5 rounded-md bg-[#1f1f1f] border border-[#2a2a2a] transition-colors flex items-center gap-1.5"
										title="Replay 3D cinematic animation"
									>
										<span>↺</span> Replay 3D
									</button>
									<div className="flex items-center gap-2 text-sm text-neutral-300 font-semibold">
										<span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
										<span>#the-writers-den</span>
									</div>
								</div>
							</div>

							{/* App Window Body: 3-Column Space Layout */}
							<div className="grid grid-cols-12 min-h-[400px] sm:min-h-[460px] text-sm">
								{/* Sidebar Navigation */}
								<div className="col-span-3 sm:col-span-3 bg-[#0f0f0f] border-r border-[#1f1f1f] p-3.5 hidden sm:flex flex-col justify-between">
									<div className="space-y-4">
										<div className="flex items-center gap-2.5 pb-2.5 border-b border-[#1f1f1f]">
											<div className="w-7 h-7 rounded-lg bg-[#7c3aed] flex items-center justify-center text-white font-bold text-sm">
												C
											</div>
											<span className="font-bold text-white text-sm truncate">The Writer's Guild</span>
										</div>

										<div className="space-y-1.5">
											<div className="text-xs uppercase tracking-wider text-neutral-400 font-bold px-2">Spaces</div>
											<div className="px-2.5 py-2 rounded-lg bg-[#1a1a1a] text-white font-semibold flex items-center gap-2">
												<span className="text-neutral-500 font-bold">#</span> the-writers-den
											</div>
											<div className="px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white font-semibold flex items-center gap-2">
												<span className="text-neutral-500 font-bold">#</span> published-stories
											</div>
											<div className="px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white font-semibold flex items-center gap-2">
												<span className="text-neutral-500 font-bold">#</span> critique-room
											</div>
											<div className="px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white font-semibold flex items-center gap-2">
												<span className="text-neutral-500 font-bold">#</span> media-vault
											</div>
										</div>
									</div>

									<div className="pt-3 border-t border-[#1f1f1f] flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-full bg-neutral-800 text-white font-bold flex items-center justify-center text-sm">
											A
										</div>
										<div className="truncate">
											<div className="text-white font-bold text-sm truncate">Alex Mercer</div>
											<div className="text-xs text-neutral-400 font-medium">@reader</div>
										</div>
									</div>
								</div>

								{/* Main Chat Column */}
								<div className="col-span-12 sm:col-span-5 p-4 bg-[#0a0a0a] flex flex-col justify-between border-r border-[#1f1f1f]">
									<div className="space-y-3.5 overflow-y-auto max-h-[320px]">
										<div className="text-neutral-400 text-xs font-semibold pb-1.5 border-b border-[#1a1a1a] flex items-center justify-between">
											<span>Realtime Chat Stream</span>
											<span className="text-emerald-400 font-bold">4 online</span>
										</div>

										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="font-bold text-white text-sm">Elena Vance</span>
												<span className="text-xs text-neutral-500">10:42 AM</span>
											</div>
											<p className="text-neutral-200 text-sm leading-relaxed font-semibold">
												Just published my full breakdown on sovereign communication models. It's pinned in published posts!
											</p>
										</div>

										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="font-bold text-white text-sm">Marcus Thorne</span>
												<span className="text-xs text-neutral-500">10:43 AM</span>
											</div>
											<p className="text-neutral-200 text-sm leading-relaxed font-semibold">
												Reading it now. The distinction between continuous chat and deliberate longform is so clear.
											</p>
										</div>

										<div className="p-3 rounded-lg bg-[#141414] border border-[#222222] text-neutral-200 space-y-1">
											<div className="text-xs text-[#7c3aed] font-bold uppercase tracking-wider">
												Echoed from #philosophy-realm
											</div>
											<div className="text-sm text-white font-bold">
												"Communication for people who think in words."
											</div>
										</div>
									</div>

									<div className="pt-3">
										<div className="p-3 rounded-xl bg-[#141414] border border-[#222222] text-neutral-400 font-semibold flex items-center justify-between text-sm">
											<span>Message #the-writers-den...</span>
											<span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">Return ↵</span>
										</div>
									</div>
								</div>

								{/* Longform Published Post Column */}
								<div className="col-span-12 sm:col-span-4 p-4 bg-[#0c0c0c] flex flex-col justify-between hidden sm:flex">
									<div className="space-y-3.5">
										<div className="flex items-center justify-between text-xs text-neutral-400 font-semibold pb-1.5 border-b border-[#1a1a1a]">
											<span>Published Post</span>
											<span className="text-emerald-400 font-bold">Pinned</span>
										</div>

										<div className="space-y-2">
											<h4 className="text-base font-bold text-white font-heading leading-snug">
												On the Independence of Communication Units
											</h4>
											<div className="text-xs text-neutral-400 font-semibold">
												By Elena Vance • 4 min read
											</div>
											<p className="text-neutral-300 text-sm leading-relaxed line-clamp-4 font-semibold">
												A Space is not a mere channel inside someone else's walled garden; it is your sovereign place to think and talk without algorithms getting in the way.
											</p>
										</div>
									</div>

									<div className="p-3 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-between text-sm">
										<span className="text-neutral-300 font-semibold">18 Responses</span>
										<span className="text-white font-bold">Read Post →</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Section 2: Scrollytelling Narrative Showcase (3-Chapter Apple-Style Word-by-Word Illumination & 3D Mascots) */}
			<ScrollytellingSection />


			{/* Section 3: "YOU CAN'T SCROLL ANYMORE. BETTER GO CHAT." CTA Section with Original Illustrated Characters */}
			<section id="get-started" className="min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-10 lg:px-16 pt-24 pb-0 relative overflow-hidden bg-black text-white">
				{/* Top CTA Content */}
				<div className="max-w-[1720px] w-full mx-auto text-center space-y-8 z-10 pt-8 sm:pt-12">
					<h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white uppercase leading-tight font-heading">
						YOU CAN&apos;T SCROLL ANYMORE.<br />
						BETTER GO CHAT.
					</h2>

					<div className="pt-2 flex flex-wrap items-center justify-center gap-4">
						<a
							href="#features"
							className="inline-flex items-center gap-2 px-10 py-5 rounded-full bg-white text-black font-bold text-base sm:text-lg hover:bg-neutral-200 transition-colors shadow-none"
						>
							Download Concord
						</a>
						<a
							href="#spaces"
							className="inline-flex items-center gap-2 px-10 py-5 rounded-full border border-[#2e2e2e] text-white font-bold text-base sm:text-lg hover:bg-neutral-900 transition-colors shadow-none"
						>
							Open in Browser
						</a>
					</div>
				</div>

				{/* Original Illustrated Characters */}
				<div className="w-full max-w-[1720px] mx-auto flex justify-center items-end relative z-10 mt-auto pt-8">
					<img
						src="/assets/images/concord-characters.jpg"
						alt="Concord Character Crew"
						className="w-full max-h-[55vh] sm:max-h-[62vh] object-contain object-bottom pointer-events-none select-none rounded-t-2xl"
					/>
				</div>
			</section>

			{/* Section 8: Concord Sovereign Fullscreen Comprehensive Footer & Gigantic Brand Wordmark */}
			<footer className="min-h-screen w-full flex flex-col justify-between px-6 sm:px-10 lg:px-16 pt-20 pb-8 bg-black text-white relative z-20">
				<div className="max-w-[1720px] mx-auto w-full pt-12">
					{/* Navigation columns */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-4 pb-20 text-base max-w-5xl">
							<div className="space-y-3">
								<div className="text-neutral-200 text-sm font-bold uppercase tracking-wider">Product</div>
								<ul className="space-y-2 text-neutral-300 font-semibold">
									<li><a href="#get-started" className="hover:text-white transition-colors">Download</a></li>
									<li><a href="#spaces" className="hover:text-white transition-colors">Spaces</a></li>
									<li><a href="#spaces" className="hover:text-white transition-colors">Realms</a></li>
									<li><a href="#features" className="hover:text-white transition-colors">Dual Modes</a></li>
									<li><a href="#features" className="hover:text-white transition-colors">Chat &amp; Posts</a></li>
								</ul>
							</div>

							<div className="space-y-3">
								<div className="text-neutral-200 text-sm font-bold uppercase tracking-wider">Company</div>
								<ul className="space-y-2 text-neutral-300 font-semibold">
									<li><a href="#features" className="hover:text-white transition-colors">About</a></li>
									<li><a href="#features" className="hover:text-white transition-colors">Jobs</a></li>
									<li><a href="#features" className="hover:text-white transition-colors">Brand</a></li>
									<li><a href="#features" className="hover:text-white transition-colors">Newsroom</a></li>
								</ul>
							</div>

							<div className="space-y-3">
								<div className="text-neutral-200 text-sm font-bold uppercase tracking-wider">Help &amp; Support</div>
								<ul className="space-y-2 text-neutral-300 font-semibold">
									<li><a href="#get-started" className="hover:text-white transition-colors">Support Center</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Safety</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Blog</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Community</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Feedback</a></li>
								</ul>
							</div>

							<div className="space-y-3">
								<div className="text-neutral-200 text-sm font-bold uppercase tracking-wider">Policies</div>
								<ul className="space-y-2 text-neutral-300 font-semibold">
									<li><a href="#get-started" className="hover:text-white transition-colors">Terms</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Privacy</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Guidelines</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Licenses</a></li>
									<li><a href="#get-started" className="hover:text-white transition-colors">Company Info</a></li>
								</ul>
							</div>
						</div>
					</div>

				{/* Bottom Giant Brand Wordmark with Copyright */}
				<div className="w-full mt-auto select-none pointer-events-none">
					<div className="max-w-[1720px] mx-auto w-full text-sm sm:text-base text-neutral-400 font-semibold pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-auto">
						<div>Concord a product of Dexx Sytems OSS. all rights reserved 2026</div>
						<div className="text-neutral-400">Dexx Systems Open Source Software</div>
					</div>
					<div className="w-full overflow-hidden text-center leading-none">
						<span className="text-[18vw] font-black tracking-tighter text-neutral-900 font-heading block select-none">
							Concord
						</span>
					</div>
				</div>
			</footer>
		</div>
	)
}
