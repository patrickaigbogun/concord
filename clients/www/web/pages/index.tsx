import React, { useState } from 'react'

export const metadata = {
	title: 'Concord — Chat without chaos. Post without noise.',
	description: 'The social hangout for your squads, creative circles, and communities. Chat fast, drop posts, and vibe across Spaces.',
}

export default function LandingPage() {
	const [activeTab, setActiveTab] = useState<'conversation' | 'posts' | 'media'>('conversation')
	const [selectedSpace, setSelectedSpace] = useState<'midnight-vibes' | 'gaming-squad' | 'creator-lounge'>('midnight-vibes')
	const [activePersona, setActivePersona] = useState<'chill' | 'gamer'>('chill')
	const [echoCount, setEchoCount] = useState(42)
	const [hasEchoed, setHasEchoed] = useState(false)
	const [reactions, setReactions] = useState<Record<string, number>>({ '🔥': 18, '💀': 27, '💖': 12, '✨': 9 })
	const [userReacted, setUserReacted] = useState<Record<string, boolean>>({})

	const handleReaction = (emoji: string) => {
		const current = reactions[emoji] || 0
		const reacted = userReacted[emoji]
		if (reacted) {
			setReactions({ ...reactions, [emoji]: current - 1 })
			setUserReacted({ ...userReacted, [emoji]: false })
		} else {
			setReactions({ ...reactions, [emoji]: current + 1 })
			setUserReacted({ ...userReacted, [emoji]: true })
		}
	}

	const handleEcho = () => {
		if (!hasEchoed) {
			setEchoCount((c) => c + 1)
			setHasEchoed(true)
		} else {
			setEchoCount((c) => c - 1)
			setHasEchoed(false)
		}
	}

	return (
		<div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden selection:bg-purple-500/30 selection:text-purple-200">
			{/* Ambient background glows */}
			<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[650px] glow-hero pointer-events-none" />
			<div className="absolute inset-0 grid-dots opacity-30 pointer-events-none" />

			{/* Floating Nav */}
			<header className="relative z-30 max-w-6xl mx-auto px-6 pt-6">
				<div className="border border-[var(--border)] backdrop-blur-xl bg-slate-950/70 rounded-2xl px-5 h-16 flex items-center justify-between shadow-xl">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-purple-500/30 animate-pulse">
							⚡
						</div>
						<span className="font-bold tracking-tight text-xl text-white">Concord</span>
					</div>

					<nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--text-muted)]">
						<a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
						<a href="#features" className="hover:text-white transition-colors">Features</a>
						<a href="#personas" className="hover:text-white transition-colors">Alter Egos</a>
						<a href="#spaces" className="hover:text-white transition-colors">Spaces & Realms</a>
					</nav>

					<div className="flex items-center gap-3">
						<a
							href="#interactive-demo"
							className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white transition-all shadow-lg shadow-purple-600/30 active:scale-95"
						>
							Try Demo ✨
						</a>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section className="relative z-20 pt-16 pb-12 px-6 max-w-5xl mx-auto text-center">
				<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs font-semibold mb-6 backdrop-blur-md shadow-md shadow-purple-900/20">
					<span className="text-pink-400">✨</span>
					<span>The next generation of hanging out online</span>
				</div>

				<h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6">
					Chat without the chaos.{' '}
					<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
						Post without the noise.
					</span>
				</h1>

				<p className="text-base sm:text-xl text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed mb-8">
					One place for your late-night squad chats, aesthetic photo dumps, shared playlists, and hot takes. Switch vibes instantly across custom Spaces.
				</p>

				<div className="flex flex-wrap items-center justify-center gap-4">
					<a
						href="#interactive-demo"
						className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:shadow-purple-500/40 text-white font-bold text-sm transition-all shadow-xl shadow-purple-600/30 flex items-center gap-2 hover:scale-[1.02] active:scale-95"
					>
						<span>Hop In Live Preview</span>
						<span>🚀</span>
					</a>
					<a
						href="#features"
						className="px-6 py-3.5 rounded-xl border border-[var(--border-light)] hover:bg-slate-800/80 text-[var(--text)] font-semibold text-sm transition-all flex items-center gap-2 bg-slate-900/40 backdrop-blur-md"
					>
						<span>See How It Works</span>
						<span>👀</span>
					</a>
				</div>

				{/* Social proof chips */}
				<div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs font-medium text-slate-400">
					<div className="flex items-center gap-2">
						<span className="text-pink-400">🔒</span> Zero algorithm feeds
					</div>
					<div className="flex items-center gap-2">
						<span className="text-purple-400">⚡</span> Real-time instant chat
					</div>
					<div className="flex items-center gap-2">
						<span className="text-cyan-400">🎭</span> Custom personas per space
					</div>
					<div className="flex items-center gap-2">
						<span className="text-emerald-400">📂</span> Photos & files never get lost
					</div>
				</div>
			</section>

			{/* Interactive UI Sandbox */}
			<section id="interactive-demo" className="relative z-20 max-w-5xl mx-auto px-6 mb-28">
				<div className="text-center mb-6">
					<span className="text-xs font-bold uppercase tracking-widest text-purple-400">Live Simulator</span>
					<h3 className="text-2xl font-bold text-white mt-1">Take Concord for a spin 👇</h3>
				</div>

				<div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-2xl shadow-2xl overflow-hidden glow-purple">
					{/* Window header */}
					<div className="h-11 bg-slate-950/90 border-b border-[var(--border)] px-4 flex items-center justify-between text-xs">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-rose-500" />
							<div className="w-3 h-3 rounded-full bg-amber-500" />
							<div className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="ml-3 font-semibold text-slate-300">Concord Space — #{selectedSpace}</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
								LIVE ROOM
							</span>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
						{/* Sidebar: Spaces & Realm */}
						<div className="md:col-span-4 border-r border-[var(--border)] bg-slate-950/60 p-4 flex flex-col justify-between">
							<div className="space-y-5">
								{/* Current Realm Card */}
								<div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-900/30 to-slate-900 border border-purple-500/30">
									<div className="flex items-center justify-between text-[11px] mb-1">
										<span className="font-bold text-purple-300 uppercase tracking-wider">Active Realm</span>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-pink-300">Community</span>
									</div>
									<div className="font-bold text-white text-base flex items-center gap-2">
										<span>✨ The Night Owls</span>
									</div>
									<div className="text-[11px] text-slate-400 mt-1">2.4k members vibing right now</div>
								</div>

								{/* Spaces selection */}
								<div className="space-y-1.5">
									<div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
										Spaces in this Realm
									</div>

									<button
										type="button"
										onClick={() => setSelectedSpace('midnight-vibes')}
										className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
											selectedSpace === 'midnight-vibes'
												? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
												: 'text-slate-400 hover:bg-slate-900 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2.5">
											<span>🌙</span>
											<span>midnight-vibes</span>
										</div>
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white font-mono">Chat+Drop</span>
									</button>

									<button
										type="button"
										onClick={() => setSelectedSpace('gaming-squad')}
										className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
											selectedSpace === 'gaming-squad'
												? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
												: 'text-slate-400 hover:bg-slate-900 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2.5">
											<span>🎮</span>
											<span>ranked-grind</span>
										</div>
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white font-mono">Clips</span>
									</button>

									<button
										type="button"
										onClick={() => setSelectedSpace('creator-lounge')}
										className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
											selectedSpace === 'creator-lounge'
												? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
												: 'text-slate-400 hover:bg-slate-900 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2.5">
											<span>🎨</span>
											<span>art-and-beats</span>
										</div>
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white font-mono">Drops</span>
									</button>
								</div>
							</div>

							{/* Contextual Persona Switcher */}
							<div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 mt-4">
								<div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center justify-between">
									<span>Your Space Persona</span>
									<span className="text-cyan-400 font-bold">Swap Identity</span>
								</div>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-md">
											{activePersona === 'chill' ? '🌸' : '👾'}
										</div>
										<div>
											<div className="text-xs font-bold text-white">
												{activePersona === 'chill' ? 'Maya (Aesthetic)' : 'Maya.exe'}
											</div>
											<div className="text-[10px] text-pink-400 font-semibold">
												{activePersona === 'chill' ? '@night-owl' : '@aim-bot'}
											</div>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setActivePersona((p) => (p === 'chill' ? 'gamer' : 'chill'))}
										className="text-[11px] px-2.5 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/30 text-purple-200 font-semibold transition-all"
									>
										Switch
									</button>
								</div>
							</div>
						</div>

						{/* Main Content Area */}
						<div className="md:col-span-8 flex flex-col justify-between bg-slate-950/30">
							{/* Space Top Bar & View Tabs */}
							<div className="border-b border-[var(--border)] px-6 py-3 bg-slate-950/50 flex items-center justify-between flex-wrap gap-3">
								<div>
									<h4 className="font-bold text-white text-sm flex items-center gap-2">
										<span>#{selectedSpace}</span>
										<span className="text-[11px] font-normal text-slate-400">Curated with love</span>
									</h4>
								</div>

								{/* View Switcher Tabs */}
								<div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
									<button
										type="button"
										onClick={() => setActiveTab('conversation')}
										className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
											activeTab === 'conversation'
												? 'bg-purple-600 text-white shadow-md'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										💬 Fast Chat
									</button>
									<button
										type="button"
										onClick={() => setActiveTab('posts')}
										className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
											activeTab === 'posts'
												? 'bg-purple-600 text-white shadow-md'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										📝 Drops & Takes
									</button>
									<button
										type="button"
										onClick={() => setActiveTab('media')}
										className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
											activeTab === 'media'
												? 'bg-purple-600 text-white shadow-md'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										📸 Photo Dump
									</button>
								</div>
							</div>

							{/* Dynamic Viewport */}
							<div className="p-6 flex-1 overflow-y-auto space-y-4">
								{activeTab === 'conversation' && (
									<div className="space-y-4">
										<div className="flex items-start gap-3">
											<div className="w-8 h-8 rounded-xl bg-cyan-600/80 border border-cyan-400/40 flex items-center justify-center text-xs text-white font-bold shrink-0">
												🎧
											</div>
											<div className="flex-1 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														<span className="font-bold text-xs text-white">Jordan</span>
														<span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/40">
															@beats
														</span>
													</div>
													<span className="text-[10px] text-slate-500">11:14 PM</span>
												</div>
												<p className="text-xs text-slate-200 leading-relaxed">
													Did anyone see the new playlist drop? Check the <span className="text-pink-400 font-bold">Drops & Takes</span> tab so it doesn't get buried here in the chat stream! 🎶
												</p>
											</div>
										</div>

										<div className="flex items-start gap-3">
											<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 border border-pink-400/40 flex items-center justify-center text-xs text-white font-bold shrink-0">
												{activePersona === 'chill' ? '🌸' : '👾'}
											</div>
											<div className="flex-1 bg-purple-950/30 p-3.5 rounded-2xl border border-purple-500/30">
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														<span className="font-bold text-xs text-pink-200">
															{activePersona === 'chill' ? 'Maya (Aesthetic)' : 'Maya.exe'}
														</span>
														<span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-pink-300 font-semibold border border-purple-600/40">
															{activePersona === 'chill' ? '@night-owl' : '@aim-bot'}
														</span>
													</div>
													<span className="text-[10px] text-slate-500">11:15 PM</span>
												</div>
												<p className="text-xs text-slate-200 leading-relaxed">
													I'm obsessed with this. Having both fast chat AND published posts in the same room is so clean. Click the reactions below! 👇
												</p>

												{/* Interactive Reaction Pills */}
												<div className="flex items-center gap-2 mt-3 flex-wrap">
													{(['🔥', '💀', '💖', '✨'] as const).map((emoji) => (
														<button
															key={emoji}
															type="button"
															onClick={() => handleReaction(emoji)}
															className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
																userReacted[emoji]
																	? 'bg-purple-600 text-white scale-105 shadow-md shadow-purple-600/30'
																	: 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
															}`}
														>
															<span>{emoji}</span>
															<span>{reactions[emoji] || 0}</span>
														</button>
													))}
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === 'posts' && (
									<div className="space-y-4">
										<div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl hover:border-purple-500/60 transition-all">
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<span className="text-sm font-bold text-white">Why midnight playlists always hit harder</span>
													<span className="text-[10px] px-2.5 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800/40 font-bold">
														Featured Drop
													</span>
												</div>
												<span className="text-[11px] text-slate-500">1h ago</span>
											</div>
											<p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mb-4">
												There's something about 1am when the world goes quiet and you discover an indie synth track that completely resets your brain chemistry. Here are 5 tracks that redefined my week...
											</p>
											<div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
												<div className="flex items-center gap-3 font-semibold">
													<span>💬 34 comments</span>
													<span>Author: @jordan_beats</span>
												</div>
												<button
													type="button"
													onClick={handleEcho}
													className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
														hasEchoed
															? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white scale-105'
															: 'bg-slate-800 text-slate-200 hover:bg-slate-700'
													}`}
												>
													<span>🔁 Echo to Squad</span>
													<span className="font-mono bg-black/30 px-1.5 py-0.5 rounded text-[10px]">
														{echoCount}
													</span>
												</button>
											</div>
										</div>

										<div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
											<div className="flex items-center justify-between mb-1">
												<div className="flex items-center gap-2">
													<span className="text-xs font-bold text-slate-200">The Ranked Tier List nobody asked for</span>
													<span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-bold">
														Echo from #gaming
													</span>
												</div>
												<span className="text-[11px] text-slate-500">Yesterday</span>
											</div>
											<p className="text-xs text-slate-400 line-clamp-2">
												Don't @ me if your main is in D-tier. Here's why movement speed wins every 1v1 matchup in the new patch.
											</p>
										</div>
									</div>
								)}

								{activeTab === 'media' && (
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
										<div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-purple-500/50 transition-all cursor-pointer">
											<span className="text-3xl mb-2">📸</span>
											<span className="text-xs font-bold text-white truncate w-full">tokyo_night_walk.jpg</span>
											<span className="text-[10px] text-pink-400 font-semibold mt-0.5">3.2 MB • Photo</span>
										</div>
										<div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-purple-500/50 transition-all cursor-pointer">
											<span className="text-3xl mb-2">🎵</span>
											<span className="text-xs font-bold text-white truncate w-full">lofi_synth_loop.wav</span>
											<span className="text-[10px] text-cyan-400 font-semibold mt-0.5">14.1 MB • Audio</span>
										</div>
										<div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-purple-500/50 transition-all cursor-pointer">
											<span className="text-3xl mb-2">🎬</span>
											<span className="text-xs font-bold text-white truncate w-full">clutch_ace_clip.mp4</span>
											<span className="text-[10px] text-purple-400 font-semibold mt-0.5">28.4 MB • Video</span>
										</div>
									</div>
								)}
							</div>

							{/* Interactive Chat Input */}
							<div className="p-4 border-t border-[var(--border)] bg-slate-950/70">
								<div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5">
									<span className="text-slate-400 text-sm">✨</span>
									<input
										type="text"
										readOnly
										value={
											activeTab === 'conversation'
												? `Chatting in #${selectedSpace} as ${activePersona === 'chill' ? 'Maya (Aesthetic)' : 'Maya.exe'}...`
												: `Drop your thoughts or media in #${selectedSpace}...`
										}
										className="bg-transparent text-xs text-slate-300 w-full focus:outline-none placeholder:text-slate-500 cursor-default"
									/>
									<button
										type="button"
										className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold hover:opacity-95 transition-all shadow-md shadow-purple-600/20"
									>
										Send
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* What makes Concord different */}
			<section id="how-it-works" className="relative z-20 max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)]">
				<div className="text-center max-w-2xl mx-auto mb-16">
					<span className="text-xs font-bold uppercase tracking-widest text-pink-400">Why You'll Love It</span>
					<h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
						Built for the way you actually communicate.
					</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					{/* Feature 1 */}
					<div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-purple-500/50 transition-all group mesh-card">
						<div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
							💬
						</div>
						<h3 className="text-lg font-bold text-white mb-2">Fast Chat & Real Drops</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							Spam reactions and talk in real-time. When you have something cool to share, publish a Drop so it gets its own dedicated comments without getting buried.
						</p>
					</div>

					{/* Feature 2 */}
					<div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-pink-500/50 transition-all group mesh-card">
						<div className="w-12 h-12 rounded-2xl bg-pink-600/20 border border-pink-500/30 text-pink-300 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
							🎭
						</div>
						<h3 className="text-lg font-bold text-white mb-2">Instant Alter-Egos</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							No more making alternate accounts. Have different handles, tags, and vibes for your gaming squad, creative circles, and close friends—all on one profile.
						</p>
					</div>

					{/* Feature 3 */}
					<div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-cyan-500/50 transition-all group mesh-card">
						<div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
							🔁
						</div>
						<h3 className="text-lg font-bold text-white mb-2">Echo the Best Stuff</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							Found a hilarious meme or top tier post? Echo it to your other squads with one tap. The original author always stays credited.
						</p>
					</div>
				</div>
			</section>

			{/* Visual Persona Showcase */}
			<section id="personas" className="relative z-20 max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)]">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
					<div>
						<span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Contextual Personas</span>
						<h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2 mb-6">
							Be whoever you want in every Space.
						</h2>
						<p className="text-base text-[var(--text-muted)] leading-relaxed mb-6">
							You're not the exact same person in your gaming squad as you are in your study group or book club. Concord gives you space-scoped tags so you fit the vibe everywhere you go.
						</p>

						<div className="space-y-3">
							<div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-xl">🎮</span>
									<div>
										<div className="text-xs font-bold text-white">Ranked Grind Space</div>
										<div className="text-[11px] text-purple-400 font-semibold">Maya.exe @aim-bot</div>
									</div>
								</div>
								<span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">Gamer Vibe</span>
							</div>

							<div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-xl">🎨</span>
									<div>
										<div className="text-xs font-bold text-white">Creative Studio Space</div>
										<div className="text-[11px] text-pink-400 font-semibold">Maya @art-and-coffee</div>
									</div>
								</div>
								<span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">Aesthetic Vibe</span>
							</div>

							<div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-xl">📚</span>
									<div>
										<div className="text-xs font-bold text-white">Study Lounge Space</div>
										<div className="text-[11px] text-cyan-400 font-semibold">Maya Chen @focus-mode</div>
									</div>
								</div>
								<span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">Study Vibe</span>
							</div>
						</div>
					</div>

					<div className="p-8 rounded-3xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-pink-950/30 border border-purple-500/30 text-center glow-pink">
						<div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 flex items-center justify-center text-4xl mx-auto shadow-2xl shadow-purple-500/40 mb-6">
							✨
						</div>
						<h3 className="text-xl font-bold text-white mb-2">One Global Profile. Infinite Personas.</h3>
						<p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
							No more switching between three Discord accounts or managing burner handles. Concord seamlessly manages your identity everywhere.
						</p>
					</div>
				</div>
			</section>

			{/* Call To Action Banner */}
			<section className="relative z-20 max-w-5xl mx-auto px-6 py-20">
				<div className="p-10 sm:p-16 rounded-3xl bg-gradient-to-r from-purple-900/70 via-pink-900/50 to-indigo-900/70 border border-purple-500/40 text-center shadow-2xl glow-purple relative overflow-hidden">
					<div className="absolute inset-0 grid-dots opacity-20 pointer-events-none" />
					<div className="relative z-10">
						<span className="text-xs font-bold uppercase tracking-widest text-pink-300">Ready to level up?</span>
						<h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2 mb-4">
							Start hanging out in Concord.
						</h2>
						<p className="text-sm sm:text-base text-purple-200/80 max-w-xl mx-auto mb-8">
							Free, fast, and built for people who love to talk, share, and build genuine community.
						</p>

						<div className="flex flex-wrap items-center justify-center gap-4">
							<a
								href="#interactive-demo"
								className="px-8 py-4 rounded-2xl bg-white text-slate-950 font-black text-sm hover:bg-slate-100 transition-all shadow-xl hover:scale-105 active:scale-95"
							>
								Launch Concord ✨
							</a>
						</div>
					</div>
				</div>
			</section>

			{/* Simple Footer */}
			<footer className="relative z-20 border-t border-[var(--border)] bg-slate-950 py-10 px-6">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
					<div className="flex items-center gap-3">
						<div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-bold text-white text-xs">
							⚡
						</div>
						<span className="font-bold text-sm text-white">Concord</span>
						<span className="text-xs text-slate-500">© 2026. Built for real conversations.</span>
					</div>

					<div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
						<a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
						<a href="#personas" className="hover:text-white transition-colors">Alter Egos</a>
						<a href="https://github.com/patrickaigbogun/concord" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
							GitHub
						</a>
					</div>
				</div>
			</footer>
		</div>
	)
}
