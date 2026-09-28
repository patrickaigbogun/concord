import React, { useState } from 'react'

export const metadata = {
	title: 'Concord — Communication for people who think in words',
	description: 'A writing- and discussion-centric messaging platform structured around sovereign Spaces and federated Realms.',
}

export default function LandingPage() {
	const [activeTab, setActiveTab] = useState<'conversation' | 'posts' | 'media'>('conversation')
	const [selectedSpace, setSelectedSpace] = useState<'essays' | 'dev-stream' | 'governance'>('essays')
	const [activePersona, setActivePersona] = useState<'scholar' | 'builder'>('scholar')
	const [echoCount, setEchoCount] = useState(14)
	const [hasEchoed, setHasEchoed] = useState(false)

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
		<div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
			{/* Ambient background glows */}
			<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] radial-gradient-bg pointer-events-none" />
			<div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

			{/* Navigation */}
			<header className="relative z-20 border-b border-[var(--border)] backdrop-blur-md bg-[var(--bg)]/80 sticky top-0">
				<div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
							C
						</div>
						<span className="font-semibold tracking-tight text-lg text-white">Concord</span>
						<span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
							v1.0 Preview
						</span>
					</div>

					<nav className="hidden md:flex items-center gap-8 text-sm text-[var(--text-muted)]">
						<a href="#mental-model" className="hover:text-white transition-colors">Mental Model</a>
						<a href="#dual-messaging" className="hover:text-white transition-colors">Dual Messaging</a>
						<a href="#architecture" className="hover:text-white transition-colors">Separation of Authority</a>
						<a href="#protocol" className="hover:text-white transition-colors">Stateless Protocol</a>
					</nav>

					<div className="flex items-center gap-3">
						<a
							href="http://localhost:4000/api/swagger"
							target="_blank"
							rel="noreferrer"
							className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-light)] text-[var(--text-muted)] hover:text-white hover:border-slate-500 transition-all"
						>
							API Docs
						</a>
						<a
							href="#interactive-demo"
							className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
						>
							Explore Demo
						</a>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section className="relative z-10 pt-20 pb-16 px-6 max-w-5xl mx-auto text-center">
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6 backdrop-blur-sm">
					<span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
					A Writing-Oriented Communication System
				</div>

				<h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
					Communication for people who <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">think in words.</span>
				</h1>

				<p className="text-lg sm:text-xl text-[var(--text-muted)] max-w-3xl mx-auto leading-relaxed mb-10">
					Concord gets messaging right. Fast, fluid conversational chat paired with deliberately published posts, structured around sovereign Spaces and federated Realms with genuine separation of power.
				</p>

				<div className="flex flex-wrap items-center justify-center gap-4">
					<a
						href="#interactive-demo"
						className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
					>
						<span>Test Interactive Space</span>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
						</svg>
					</a>
					<a
						href="https://github.com/patrickaigbogun/concord"
						target="_blank"
						rel="noreferrer"
						className="px-6 py-3 rounded-lg border border-[var(--border-light)] hover:bg-slate-800/60 text-[var(--text)] font-medium text-sm transition-all flex items-center gap-2"
					>
						<svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
							<path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
						</svg>
						<span>View Source Repository</span>
					</a>
				</div>
			</section>

			{/* Interactive UI Showcase */}
			<section id="interactive-demo" className="relative z-10 max-w-6xl mx-auto px-6 mb-28">
				<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-xl shadow-2xl overflow-hidden glow-primary">
					{/* Mock App Chrome */}
					<div className="h-10 bg-slate-950/80 border-b border-[var(--border)] px-4 flex items-center justify-between text-xs text-[var(--text-subtle)]">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-rose-500/80" />
							<div className="w-3 h-3 rounded-full bg-amber-500/80" />
							<div className="w-3 h-3 rounded-full bg-emerald-500/80" />
							<span className="ml-3 font-mono text-[11px] text-slate-400">concord://realms/writers-guild/spaces/{selectedSpace}</span>
						</div>
						<div className="flex items-center gap-3">
							<span className="flex items-center gap-1 text-emerald-400">
								<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Phoenix Channels Connected
							</span>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
						{/* Realm & Space Sidebar */}
						<div className="md:col-span-4 border-r border-[var(--border)] bg-slate-950/40 p-4 flex flex-col justify-between">
							<div className="space-y-6">
								{/* Realm Header */}
								<div>
									<div className="flex items-center justify-between mb-1">
										<div className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Realm</div>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-800/40">Federated</span>
									</div>
									<div className="text-base font-semibold text-white flex items-center gap-2">
										<span>🏰 The Writer's Guild</span>
									</div>
									<div className="text-xs text-[var(--text-muted)] mt-0.5">3 Spaces • Explicit Rules Agreemeent Active</div>
								</div>

								{/* Spaces List */}
								<div className="space-y-1">
									<div className="text-[11px] font-semibold text-[var(--text-subtle)] uppercase tracking-wider px-2 mb-1.5">
										Spaces in this Realm
									</div>

									<button
										type="button"
										onClick={() => setSelectedSpace('essays')}
										className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
											selectedSpace === 'essays'
												? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
												: 'text-[var(--text-muted)] hover:bg-slate-800/40 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2">
											<span>📜</span>
											<span className="font-medium">philosophy-drafts</span>
										</div>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">4 Views</span>
									</button>

									<button
										type="button"
										onClick={() => setSelectedSpace('dev-stream')}
										className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
											selectedSpace === 'dev-stream'
												? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
												: 'text-[var(--text-muted)] hover:bg-slate-800/40 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2">
											<span>⚡</span>
											<span className="font-medium">engineering-stream</span>
										</div>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Chat</span>
									</button>

									<button
										type="button"
										onClick={() => setSelectedSpace('governance')}
										className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
											selectedSpace === 'governance'
												? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
												: 'text-[var(--text-muted)] hover:bg-slate-800/40 hover:text-white'
										}`}
									>
										<div className="flex items-center gap-2">
											<span>⚖️</span>
											<span className="font-medium">space-curators</span>
										</div>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-300">Curators</span>
									</button>
								</div>
							</div>

							{/* Contextual Persona Box */}
							<div className="p-3 rounded-xl bg-slate-900/80 border border-[var(--border)] mt-4">
								<div className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center justify-between">
									<span>Contextual Tag Persona</span>
									<span className="text-cyan-400 font-mono">space-scoped</span>
								</div>
								<div className="flex items-center justify-between gap-2 mt-2">
									<div className="flex items-center gap-2">
										<div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
											{activePersona === 'scholar' ? 'A' : 'B'}
										</div>
										<div>
											<div className="text-xs font-medium text-white">
												{activePersona === 'scholar' ? 'Alex (Scholar)' : 'Alex_Dev'}
											</div>
											<div className="text-[10px] text-slate-400">
												{activePersona === 'scholar' ? '@essayist' : '@systems-engineer'}
											</div>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setActivePersona((p) => (p === 'scholar' ? 'builder' : 'scholar'))}
										className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors"
									>
										Switch Tag
									</button>
								</div>
							</div>
						</div>

						{/* Space Views & Main Stage */}
						<div className="md:col-span-8 flex flex-col justify-between bg-slate-950/20">
							{/* Space Top Bar & View Tabs */}
							<div className="border-b border-[var(--border)] px-6 py-3 bg-slate-950/40 flex items-center justify-between flex-wrap gap-3">
								<div>
									<h3 className="font-semibold text-white text-base flex items-center gap-2">
										<span>#{selectedSpace}</span>
										<span className="text-xs font-normal text-slate-400">Space Curator: @elena</span>
									</h3>
								</div>

								{/* Navigation Tabs */}
								<div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-[var(--border)]">
									<button
										type="button"
										onClick={() => setActiveTab('conversation')}
										className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
											activeTab === 'conversation'
												? 'bg-indigo-600 text-white shadow-sm'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										💬 Conversation
									</button>
									<button
										type="button"
										onClick={() => setActiveTab('posts')}
										className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
											activeTab === 'posts'
												? 'bg-indigo-600 text-white shadow-sm'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										📝 Published Posts
									</button>
									<button
										type="button"
										onClick={() => setActiveTab('media')}
										className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
											activeTab === 'media'
												? 'bg-indigo-600 text-white shadow-sm'
												: 'text-slate-400 hover:text-white'
										}`}
									>
										🖼 Media & Files
									</button>
								</div>
							</div>

							{/* Tab Content Viewport */}
							<div className="p-6 flex-1 overflow-y-auto space-y-4">
								{activeTab === 'conversation' && (
									<div className="space-y-4 animate-fadeIn">
										<div className="flex items-start gap-3">
											<div className="w-8 h-8 rounded-full bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center text-xs text-white font-bold shrink-0">
												E
											</div>
											<div className="flex-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-xs text-white">Elena</span>
														<span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900/40 text-indigo-300 font-mono">Curator</span>
													</div>
													<span className="text-[10px] text-slate-500">10:42 AM</span>
												</div>
												<p className="text-xs text-slate-300 leading-relaxed">
													Continuous chat flows naturally here without creating clutter. If anyone publishes a long-form draft, remember to use the <span className="text-indigo-400 font-mono">Published Posts</span> tab so it gets dedicated discussion space!
												</p>
											</div>
										</div>

										<div className="flex items-start gap-3">
											<div className="w-8 h-8 rounded-full bg-indigo-600 border border-indigo-400/40 flex items-center justify-center text-xs text-white font-bold shrink-0">
												{activePersona === 'scholar' ? 'A' : 'B'}
											</div>
											<div className="flex-1 bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/20">
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-xs text-indigo-200">
															{activePersona === 'scholar' ? 'Alex (Scholar)' : 'Alex_Dev'}
														</span>
														<span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
															{activePersona === 'scholar' ? '@essayist' : '@systems-engineer'}
														</span>
													</div>
													<span className="text-[10px] text-slate-500">10:45 AM</span>
												</div>
												<p className="text-xs text-slate-300 leading-relaxed">
													Agreed. The separation of powers is clean too—joining this Realm didn't force us to surrender curation of our Space.
												</p>
												<div className="flex items-center gap-2 mt-2">
													<span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer hover:bg-slate-700">
														✨ 4
													</span>
													<span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer hover:bg-slate-700">
														💡 2
													</span>
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === 'posts' && (
									<div className="space-y-4 animate-fadeIn">
										<div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 hover:border-indigo-500/50 transition-all">
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<span className="text-xs font-semibold text-white">The Architecture of Poetic Systems</span>
													<span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40">
														Published Post
													</span>
												</div>
												<span className="text-[11px] text-slate-500">2h ago</span>
											</div>
											<p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mb-3">
												"When we build software for writing and conversation, we are not building technical containers; we are designing environments where ideas can breathe without feeling like workplace task queues..."
											</p>
											<div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
												<div className="flex items-center gap-4">
													<span>💬 18 Comments</span>
													<span>Author: @marcus</span>
												</div>
												<button
													type="button"
													onClick={handleEcho}
													className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
														hasEchoed
															? 'bg-indigo-600 text-white'
															: 'bg-slate-800 text-slate-300 hover:bg-slate-700'
													}`}
												>
													<span>🔁 Echo Post</span>
													<span className="font-mono text-[10px] bg-slate-900/50 px-1 rounded">{echoCount}</span>
												</button>
											</div>
										</div>

										<div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all">
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<span className="text-xs font-semibold text-slate-200">Evolving the Lexicon of Community Platforms</span>
													<span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
														Echo from #general
													</span>
												</div>
												<span className="text-[11px] text-slate-500">Yesterday</span>
											</div>
											<p className="text-xs text-slate-400 line-clamp-2">
												Why Realms, Spaces, Curators, and Echoes replace the stale legacy mental model of servers, categories, and channels.
											</p>
										</div>
									</div>
								)}

								{activeTab === 'media' && (
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fadeIn">
										<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-indigo-500/40 transition-all">
											<span className="text-2xl mb-1">📑</span>
											<span className="text-xs font-medium text-white truncate w-full">manifesto_v1.pdf</span>
											<span className="text-[10px] text-slate-500">2.4 MB • Document</span>
										</div>
										<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-indigo-500/40 transition-all">
											<span className="text-2xl mb-1">🎨</span>
											<span className="text-xs font-medium text-white truncate w-full">space_canvas.png</span>
											<span className="text-[10px] text-slate-500">1.1 MB • Image</span>
										</div>
										<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-indigo-500/40 transition-all">
											<span className="text-2xl mb-1">📊</span>
											<span className="text-xs font-medium text-white truncate w-full">roadmap_2026.pdf</span>
											<span className="text-[10px] text-slate-500">840 KB • Document</span>
										</div>
									</div>
								)}
							</div>

							{/* Chat Input Bar */}
							<div className="p-4 border-t border-[var(--border)] bg-slate-950/60">
								<div className="flex items-center gap-2 bg-slate-900 border border-[var(--border-light)] rounded-xl px-4 py-2">
									<input
										type="text"
										readOnly
										value={
											activeTab === 'conversation'
												? `Send a message to #${selectedSpace} as ${activePersona === 'scholar' ? 'Alex (Scholar)' : 'Alex_Dev'}...`
												: `Publish or comment in #${selectedSpace}...`
										}
										className="bg-transparent text-xs text-slate-300 w-full focus:outline-none placeholder:text-slate-500 cursor-default"
									/>
									<button
										type="button"
										className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors"
									>
										Send
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Core Pillars / Mental Model Grid */}
			<section id="mental-model" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-[var(--border)]">
				<div className="text-center max-w-3xl mx-auto mb-16">
					<h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
						The Concord Mental Model
					</h2>
					<p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
						Rebuilding social communication from first principles.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					{/* Card 1 */}
					<div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-indigo-500/40 transition-all group">
						<div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl mb-6 group-hover:scale-105 transition-transform">
							🪐
						</div>
						<h3 className="text-lg font-semibold text-white mb-2">Spaces as Sovereignty</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							A Space is the fundamental communication unit. Spaces maintain independent identity, settings, content, and curators rather than being mere sub-channels.
						</p>
					</div>

					{/* Card 2 */}
					<div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-purple-500/40 transition-all group">
						<div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl mb-6 group-hover:scale-105 transition-transform">
							🏰
						</div>
						<h3 className="text-lg font-semibold text-white mb-2">Federated Realms</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							Realms group Spaces without absorbing them. Joining a Realm brings spaces together under agreed rules without turning Realm curators into Space curators.
						</p>
					</div>

					{/* Card 3 */}
					<div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-cyan-500/40 transition-all group">
						<div className="w-12 h-12 rounded-xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl mb-6 group-hover:scale-105 transition-transform">
							🎭
						</div>
						<h3 className="text-lg font-semibold text-white mb-2">Contextual Personas</h3>
						<p className="text-sm text-[var(--text-muted)] leading-relaxed">
							Keep your global profile while customizing contextual tags and personas for specific Spaces. Be formal in professional spaces and casual in creative ones.
						</p>
					</div>
				</div>
			</section>

			{/* Dual Communication Mode */}
			<section id="dual-messaging" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-[var(--border)]">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
					<div>
						<div className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
							Dual Communication Modes
						</div>
						<h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-6">
							Fast continuous chat. Deliberate published posts.
						</h2>
						<p className="text-base text-[var(--text-muted)] leading-relaxed mb-6">
							Conventional platforms force you to choose between chaotic unending chat streams or stiff forum structures. Concord natively supports both within every Space.
						</p>

						<div className="space-y-4">
							<div className="flex items-start gap-4">
								<div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm shrink-0">
									1
								</div>
								<div>
									<h4 className="text-sm font-semibold text-white">Chat Stream</h4>
									<p className="text-xs text-[var(--text-muted)] mt-1">
										Low friction, real-time message stream with reactions, emoji feedback, and typing activity.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm shrink-0">
									2
								</div>
								<div>
									<h4 className="text-sm font-semibold text-white">Published Posts</h4>
									<p className="text-xs text-[var(--text-muted)] mt-1">
										Thoughtful articles, proposals, and essays with dedicated threaded comment trees and Echo sharing.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm shrink-0">
									3
								</div>
								<div>
									<h4 className="text-sm font-semibold text-white">Echo Provenance</h4>
									<p className="text-xs text-[var(--text-muted)] mt-1">
										Posts can be echoed into other Spaces while maintaining authorship provenance and respecting boundary rules.
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-900 border border-[var(--border)] space-y-4 glow-cyan">
						<div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30">
							<div className="text-xs text-indigo-300 font-mono mb-1"># Echo Boundary Policies</div>
							<div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
								<div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
									<div className="font-semibold text-white">space_only</div>
									<div className="text-[10px] text-slate-400 mt-0.5">Private context</div>
								</div>
								<div className="p-2.5 rounded-lg bg-indigo-900/40 border border-indigo-600/40">
									<div className="font-semibold text-indigo-200">realm_only</div>
									<div className="text-[10px] text-slate-300 mt-0.5">Internal circle</div>
								</div>
								<div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
									<div className="font-semibold text-white">universal</div>
									<div className="text-[10px] text-slate-400 mt-0.5">Public federation</div>
								</div>
							</div>
						</div>

						<div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
							<div className="text-xs text-slate-300 font-medium mb-1">Explicit Rule Checklist Federation</div>
							<p className="text-xs text-[var(--text-muted)] leading-relaxed">
								Spaces reviewing admission into a Realm explicitly accept checklist items before constraints apply:
							</p>
							<div className="mt-3 space-y-1.5 text-xs text-slate-300">
								<div className="flex items-center gap-2">
									<span className="text-emerald-400">✓</span>
									<span>Civility & Code of Conduct accepted</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-emerald-400">✓</span>
									<span>Echo boundaries preserved across realm spaces</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Developer Protocol & Client Agnostic Architecture */}
			<section id="protocol" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-[var(--border)]">
				<div className="text-center max-w-3xl mx-auto mb-16">
					<h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-3">
						Client-Agnostic Architecture
					</h2>
					<p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
						Stateless Phoenix API. Type-Safe Client Generation.
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
					<div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col justify-between">
						<div>
							<h3 className="text-xl font-semibold text-white mb-4">Multi-Client Monorepo</h3>
							<p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
								The centralized Phoenix API acts as a stateless single source of truth. Web, mobile, and desktop clients interact via typed SDKs generated from the live OpenAPI specification.
							</p>

							<div className="space-y-3 text-xs font-mono text-slate-300">
								<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
									<span>clients/www</span>
									<span className="text-emerald-400">Dex SPA + React 19</span>
								</div>
								<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
									<span>clients/mobile</span>
									<span className="text-indigo-400">Stateless Native API Client</span>
								</div>
								<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
									<span>clients/desktop</span>
									<span className="text-cyan-400">Cross-platform Shell</span>
								</div>
								<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
									<span>server/api</span>
									<span className="text-purple-400">Phoenix Channels & REST</span>
								</div>
							</div>
						</div>
					</div>

					<div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto flex flex-col justify-between">
						<div>
							<div className="text-slate-500 mb-2">// Typed client usage with @dex/pie SDK</div>
							<pre className="text-indigo-300 leading-relaxed">
{`import { createApiClient } from '@/core/api/generated'

const api = createApiClient({ baseUrl: 'http://localhost:4000' })

// 1. Fetch continuous chat stream
const { data: messages } = await api.spaces({ id: spaceId })
  .messages.get({ query: { limit: 50 } })

// 2. Publish a post in Space
const { data: post } = await api.spaces({ id: spaceId })
  .posts.post({
    body: {
      title: "The Architecture of Poetic Systems",
      body: "...",
      echo_policy: "universal"
    }
  })`}
							</pre>
						</div>
						<div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
							<span>Generated directly from OpenApiSpex</span>
							<span className="text-cyan-400">bun run generate:api</span>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="relative z-10 border-t border-[var(--border)] bg-slate-950/80 py-12 px-6">
				<div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
					<div className="flex items-center gap-3">
						<div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
							C
						</div>
						<span className="font-semibold text-sm text-white">Concord</span>
						<span className="text-xs text-slate-500">© 2026. All rights reserved.</span>
					</div>

					<div className="flex items-center gap-6 text-xs text-slate-400">
						<a href="http://localhost:4000/api/swagger" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
							Swagger Specs
						</a>
						<a href="http://localhost:4000/api/openapi.json" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
							OpenAPI JSON
						</a>
						<a href="https://github.com/patrickaigbogun/concord" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
							GitHub
						</a>
					</div>
				</div>
			</footer>
		</div>
	)
}
