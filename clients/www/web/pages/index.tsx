import React, { useState } from 'react'

export const metadata = {
	title: 'Concord — Communication for people who think in words',
	description: 'A writing- and discussion-centric platform structured around sovereign Spaces and federated Realms.',
}

export default function LandingPage() {
	const [activeTab, setActiveTab] = useState<'conversation' | 'posts' | 'media'>('conversation')
	const [activePersona, setActivePersona] = useState<'reading' | 'studio'>('reading')
	const [echoed, setEchoed] = useState(false)
	const [echoCount, setEchoCount] = useState(18)

	const toggleEcho = () => {
		if (echoed) {
			setEchoCount((c) => c - 1)
			setEchoed(false)
		} else {
			setEchoCount((c) => c + 1)
			setEchoed(true)
		}
	}

	return (
		<div className="bg-black text-white selection:bg-white selection:text-black">
			{/* Fixed Header */}
			<header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#1f1f1f]">
				<div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="font-bold tracking-tight text-lg text-white font-heading">Concord</span>
					</div>

					<nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest text-neutral-400 font-mono">
						<a href="#dual-modes" className="hover:text-white transition-colors">Chat & Posts</a>
						<a href="#spaces-realms" className="hover:text-white transition-colors">Spaces & Realms</a>
						<a href="#identity" className="hover:text-white transition-colors">Identity</a>
						<a href="#echo" className="hover:text-white transition-colors">Echo</a>
						<a href="#views" className="hover:text-white transition-colors">Media Views</a>
					</nav>

					<div className="flex items-center gap-4">
						<a
							href="#get-started"
							className="px-5 py-2 text-xs font-semibold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors"
						>
							Open App
						</a>
					</div>
				</div>
			</header>

			{/* Section 1: Hero — Unified Communication */}
			<section className="min-h-screen flex flex-col justify-center px-6 pt-24 pb-16 relative">
				<div className="max-w-5xl mx-auto w-full text-center space-y-8">
					<div className="inline-block px-4 py-1.5 border border-[#2e2e2e] text-neutral-400 text-xs uppercase tracking-widest rounded-full font-mono">
						The Next Generation Messaging Platform
					</div>

					<h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-none font-heading">
						Communication for people who think in words.
					</h1>

					<p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto font-normal leading-relaxed">
						Fast continuous conversations and deliberate published posts living together in sovereign Spaces and federated Realms.
					</p>

					<div className="flex flex-wrap items-center justify-center gap-4 pt-4">
						<a
							href="#dual-modes"
							className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
						>
							Explore the Concept
						</a>
						<a
							href="https://github.com/patrickaigbogun/concord"
							target="_blank"
							rel="noreferrer"
							className="px-8 py-3.5 rounded-full border border-[#2e2e2e] text-white font-semibold text-sm hover:bg-neutral-900 transition-colors"
						>
							Source Code
						</a>
					</div>
				</div>
			</section>

			{/* Section 2: Dual Modes — Chat vs. Posts */}
			<section id="dual-modes" className="min-h-screen flex flex-col justify-center px-6 py-20">
				<div className="max-w-6xl mx-auto w-full">
					<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-3">
						01 — Dual Messaging Architecture
					</div>
					<h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 font-heading">
						Fast continuous chat. Deliberate published posts.
					</h2>
					<p className="text-lg text-neutral-400 max-w-3xl mb-12 leading-relaxed">
						Traditional platforms force everything into either endless chaotic chat logs or rigid forum threads. Concord offers both distinct communication modes inside every single Space.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a] flex flex-col justify-between">
							<div>
								<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-2">Mode A</div>
								<h3 className="text-2xl font-bold text-white mb-4 font-heading">Chat Stream</h3>
								<p className="text-sm text-neutral-400 leading-relaxed mb-6">
									Low-friction, realtime conversational flow for everyday discussion, instant reactions, and rapid back-and-forth exchange.
								</p>
							</div>
							<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black text-xs font-mono text-neutral-300 space-y-2">
								<div className="text-neutral-500">// Realtime continuous message</div>
								<div><span className="text-white font-bold">Elena:</span> Has everyone reviewed the latest essay draft?</div>
								<div><span className="text-white font-bold">Marcus:</span> Reading section 2 now. The distinction on curation is sharp.</div>
							</div>
						</div>

						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a] flex flex-col justify-between">
							<div>
								<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-2">Mode B</div>
								<h3 className="text-2xl font-bold text-white mb-4 font-heading">Published Posts</h3>
								<p className="text-sm text-neutral-400 leading-relaxed mb-6">
									Deliberately published writings, essays, proposals, and updates that stand apart from the chat stream with their own structured discussion trees.
								</p>
							</div>
							<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black text-xs font-mono text-neutral-300 space-y-2">
								<div className="text-neutral-500">// Deliberate publication</div>
								<div className="text-white font-bold">Title: On the Independence of Communication Units</div>
								<div className="text-neutral-400 line-clamp-2">"A Space is not a mere channel within a server; it is a sovereign context..."</div>
								<div className="text-neutral-500 text-[11px] pt-1 border-t border-[#1f1f1f]">18 comments • Author: Elena</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Section 3: Spaces & Realms — Separation of Authority */}
			<section id="spaces-realms" className="min-h-screen flex flex-col justify-center px-6 py-20">
				<div className="max-w-6xl mx-auto w-full">
					<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-3">
						02 — Organizational Model
					</div>
					<h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 font-heading">
						Sovereign Spaces. Federated Realms.
					</h2>
					<p className="text-lg text-neutral-400 max-w-3xl mb-12 leading-relaxed">
						In Concord, authority is deliberately separated. Spaces are independent entities. Realms organize Spaces without absorbing their identity or revoking their curators.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-3">Core Unit</div>
							<h3 className="text-xl font-bold text-white mb-3 font-heading">The Space</h3>
							<p className="text-sm text-neutral-400 leading-relaxed">
								The fundamental communication unit. A Space can represent two people, a focused team, or an open group. It retains its own curators, settings, and content.
							</p>
						</div>

						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-3">Grouping</div>
							<h3 className="text-xl font-bold text-white mb-3 font-heading">The Realm</h3>
							<p className="text-sm text-neutral-400 leading-relaxed">
								A higher-level organizational structure that brings related Spaces together. Membership in a Realm does not automatically grant access to internal Spaces.
							</p>
						</div>

						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-3">Governance</div>
							<h3 className="text-xl font-bold text-white mb-3 font-heading">Explicit Agreement</h3>
							<p className="text-sm text-neutral-400 leading-relaxed">
								When a Space joins a Realm, rules are accepted via an explicit checklist. Realm curators do not automatically become curators of the Space.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Section 4: Contextual Identity — Persona Tags */}
			<section id="identity" className="min-h-screen flex flex-col justify-center px-6 py-20">
				<div className="max-w-6xl mx-auto w-full">
					<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-3">
						03 — Contextual Identity
					</div>
					<h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 font-heading">
						One global account. Contextual personas.
					</h2>
					<p className="text-lg text-neutral-400 max-w-3xl mb-12 leading-relaxed">
						You do not communicate identically across every circle. Concord allows users to set contextual tags and personas specific to individual Spaces without creating secondary accounts.
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						<div className="space-y-6">
							<div className="p-7 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
								<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-1">Global Identity</div>
								<div className="text-lg font-bold text-white font-heading">Alex Mercer</div>
								<div className="text-xs font-mono text-neutral-400 mt-1">@alexmercer • Universal account identifier</div>
							</div>

							<div className="p-7 rounded-3xl border border-white/20 bg-[#0a0a0a] space-y-4">
								<div className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
									Current Space Persona ({activePersona === 'reading' ? 'Philosophy Circle' : 'Design Studio'})
								</div>
								<div className="flex items-center justify-between">
									<div>
										<div className="text-base font-bold text-white font-heading">
											{activePersona === 'reading' ? 'Alex (Reader)' : 'Alex — Type Lead'}
										</div>
										<div className="text-xs font-mono text-neutral-400 mt-0.5">
											{activePersona === 'reading' ? '@essayist' : '@typography'}
										</div>
									</div>
									<button
										type="button"
										onClick={() => setActivePersona((p) => (p === 'reading' ? 'studio' : 'reading'))}
										className="px-4 py-2 text-xs font-semibold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors"
									>
										Switch Context
									</button>
								</div>
							</div>
						</div>

						<div className="p-8 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a] space-y-4">
							<h3 className="text-xl font-bold text-white font-heading">Why Contextual Tags Matter</h3>
							<p className="text-sm text-neutral-400 leading-relaxed">
								A user might be a formal contributor in a professional working group, a student in an academic space, or an anonymous participant in a feedback session.
							</p>
							<p className="text-sm text-neutral-400 leading-relaxed">
								Concord respects this reality by scoping display tags directly to Space memberships while maintaining a unified identity backbone.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Section 5: The Echo System — Controlled Sharing */}
			<section id="echo" className="min-h-screen flex flex-col justify-center px-6 py-20">
				<div className="max-w-6xl mx-auto w-full">
					<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-3">
						04 — Content Distribution
					</div>
					<h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 font-heading">
						The Echo System. Sharing with provenance.
					</h2>
					<p className="text-lg text-neutral-400 max-w-3xl mb-12 leading-relaxed">
						When a post is shared between Spaces, it retains its relationship to the original rather than becoming an orphaned duplicate. Sharing boundaries are controlled directly by the author.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
						<div className="p-7 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="font-mono text-xs text-neutral-400 uppercase tracking-wider mb-2">Policy 1</div>
							<h3 className="text-lg font-bold text-white mb-2 font-heading">Space Only</h3>
							<p className="text-xs text-neutral-400 leading-relaxed">
								The post cannot leave the originating Space under any circumstance. Strict containment for private groups.
							</p>
						</div>

						<div className="p-7 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="font-mono text-xs text-neutral-400 uppercase tracking-wider mb-2">Policy 2</div>
							<h3 className="text-lg font-bold text-white mb-2 font-heading">Realm Only</h3>
							<p className="text-xs text-neutral-400 leading-relaxed">
								The post can only be echoed into other Spaces that belong to the exact same parent Realm.
							</p>
						</div>

						<div className="p-7 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a]">
							<div className="font-mono text-xs text-neutral-400 uppercase tracking-wider mb-2">Policy 3</div>
							<h3 className="text-lg font-bold text-white mb-2 font-heading">Universal</h3>
							<p className="text-xs text-neutral-400 leading-relaxed">
								The post can be echoed across any Space or Realm where the sharing member has post permissions.
							</p>
						</div>
					</div>

					<div className="p-7 rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a] flex items-center justify-between flex-wrap gap-4">
						<div>
							<div className="text-sm font-bold text-white font-heading">Interactive Echo Verification</div>
							<div className="text-xs text-neutral-400 mt-0.5">Test echoing a post into an external space</div>
						</div>
						<button
							type="button"
							onClick={toggleEcho}
							className={`px-5 py-2.5 rounded-full text-xs font-semibold font-mono transition-colors ${
								echoed ? 'bg-white text-black' : 'border border-[#2e2e2e] text-white hover:bg-neutral-900'
							}`}
						>
							{echoed ? `Echoed (Total: ${echoCount})` : `Echo Post (${echoCount})`}
						</button>
					</div>
				</div>
			</section>

			{/* Section 6: Multi-View Spaces — Dedicated Media & Files */}
			<section id="views" className="min-h-screen flex flex-col justify-center px-6 py-20">
				<div className="max-w-6xl mx-auto w-full">
					<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono mb-3">
						05 — Space Views
					</div>
					<h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 font-heading">
						Dedicated views. Zero lost content.
					</h2>
					<p className="text-lg text-neutral-400 max-w-3xl mb-12 leading-relaxed">
						Spaces expose different views through clean top-level tabs. Never scroll through thousands of lines of chat history to locate an uploaded document or image again.
					</p>

					<div className="rounded-3xl border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
						<div className="p-5 border-b border-[#1f1f1f] bg-black flex items-center justify-between flex-wrap gap-3">
							<div className="font-mono text-xs text-neutral-300">Space: #manuscripts</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setActiveTab('conversation')}
									className={`px-4 py-1.5 rounded-full text-xs font-mono transition-colors ${
										activeTab === 'conversation' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
									}`}
								>
									Conversation
								</button>
								<button
									type="button"
									onClick={() => setActiveTab('posts')}
									className={`px-4 py-1.5 rounded-full text-xs font-mono transition-colors ${
										activeTab === 'posts' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
									}`}
								>
									Published Posts
								</button>
								<button
									type="button"
									onClick={() => setActiveTab('media')}
									className={`px-4 py-1.5 rounded-full text-xs font-mono transition-colors ${
										activeTab === 'media' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
									}`}
								>
									Files & Media
								</button>
							</div>
						</div>

						<div className="p-8 min-h-[260px] flex flex-col justify-center">
							{activeTab === 'conversation' && (
								<div className="space-y-3 font-mono text-xs text-neutral-300">
									<div><span className="text-neutral-500">14:02</span> <span className="text-white font-bold">Marcus:</span> Pushed the revised chapter to the files tab.</div>
									<div><span className="text-neutral-500">14:05</span> <span className="text-white font-bold">Elena:</span> Found it immediately under the media tab. Reviewing now.</div>
								</div>
							)}

							{activeTab === 'posts' && (
								<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black">
									<div className="text-sm font-bold text-white mb-1 font-heading">Editorial Guidelines v2.4</div>
									<div className="text-xs text-neutral-400">Published by Elena • 24 comments • Permanent document</div>
								</div>
							)}

							{activeTab === 'media' && (
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
									<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black text-xs font-mono">
										<div className="text-white font-bold mb-1 font-heading">manuscript_v2.pdf</div>
										<div className="text-neutral-500">1.8 MB • Document</div>
									</div>
									<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black text-xs font-mono">
										<div className="text-white font-bold mb-1 font-heading">cover_typeset.png</div>
										<div className="text-neutral-500">3.4 MB • Image</div>
									</div>
									<div className="p-5 rounded-2xl border border-[#1f1f1f] bg-black text-xs font-mono">
										<div className="text-white font-bold mb-1 font-heading">audio_reading.wav</div>
										<div className="text-neutral-500">14.2 MB • Audio</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* Section 7: Fullscreen Footer (Zero Top Borders) */}
			<footer id="get-started" className="min-h-screen h-screen w-full flex flex-col justify-between px-6 py-16 text-center bg-black">
				<div className="text-xs uppercase tracking-widest text-neutral-500 font-mono">
					Concord Platform — 2026
				</div>

				<div className="max-w-4xl mx-auto w-full space-y-8 my-auto">
					<div className="inline-block px-4 py-1.5 border border-[#2e2e2e] text-neutral-400 text-xs uppercase tracking-widest rounded-full font-mono">
						Start Communicating
					</div>

					<h2 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-tight font-heading">
						Ready for a better way to talk?
					</h2>

					<p className="text-lg sm:text-xl text-neutral-400 max-w-xl mx-auto leading-relaxed">
						Experience messaging designed around writing, discussion, and sovereign organization.
					</p>

					<div className="pt-4 flex flex-wrap items-center justify-center gap-4">
						<a
							href="http://localhost:4000/api/swagger"
							target="_blank"
							rel="noreferrer"
							className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
						>
							API Specification
						</a>
						<a
							href="https://github.com/patrickaigbogun/concord"
							target="_blank"
							rel="noreferrer"
							className="px-8 py-3.5 rounded-full border border-[#2e2e2e] text-white font-semibold text-sm hover:bg-neutral-900 transition-colors"
						>
							GitHub Repository
						</a>
					</div>
				</div>

				<div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-mono">
					<div>CONCORD PLATFORM — ALL RIGHTS RESERVED</div>
					<div className="flex items-center gap-6">
						<a href="#dual-modes" className="hover:text-white transition-colors">Chat & Posts</a>
						<a href="#spaces-realms" className="hover:text-white transition-colors">Spaces & Realms</a>
						<a href="#identity" className="hover:text-white transition-colors">Identity</a>
						<a href="#echo" className="hover:text-white transition-colors">Echo</a>
						<a href="https://github.com/patrickaigbogun/concord" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
					</div>
				</div>
			</footer>
		</div>
	)
}
