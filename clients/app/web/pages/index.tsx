import { useEffect, useState } from 'react'
import {
	clearSession,
	getSession,
	listenForTauriDeepLink,
	startSignIn,
	type ConcordSession,
} from '../../lib/auth'

export const metadata = { title: 'Concord' }

export default function ConcordHomePage() {
	const [session, setSession] = useState<ConcordSession | null>(null)

	useEffect(() => {
		setSession(getSession())
		let unlisten: (() => void) | undefined
		listenForTauriDeepLink((s) => setSession(s)).then((fn) => {
			unlisten = fn
		})
		return () => {
			unlisten?.()
		}
	}, [])

	return (
		<main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
			<div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#121215] p-8 space-y-6">
				<div className="flex items-center gap-3">
					<svg className="w-9 h-9 text-[#8b5cf6]" viewBox="0 0 100 100" fill="none">
						<path d="M 68 22 A 38 38 0 1 0 68 78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
						<circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="10" />
					</svg>
					<div>
						<h1 className="text-xl font-bold tracking-tight">Concord</h1>
						<p className="text-xs text-zinc-400">Dex v0.3.0 + Tauri v2 Unified Client</p>
					</div>
				</div>

				{session ? (
					<div className="space-y-4">
						<div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#18181c] p-3.5">
							{session.user.avatar_url ? (
								<img
									src={session.user.avatar_url}
									alt={session.user.display_name}
									className="w-11 h-11 rounded-full object-cover"
								/>
							) : (
								<div className="w-11 h-11 rounded-full bg-[#8b5cf6] flex items-center justify-center font-bold">
									{session.user.display_name?.[0] || session.user.username?.[0]}
								</div>
							)}
							<div className="min-w-0">
								<div className="font-semibold truncate">{session.user.display_name}</div>
								<div className="text-xs text-zinc-400 truncate">@{session.user.username}</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => {
								clearSession()
								setSession(null)
							}}
							className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-sm font-semibold transition"
						>
							Sign Out
						</button>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-zinc-400 leading-relaxed">
							Sign in with Concord ID to access your Spaces, Realms, and live conversations across desktop and mobile.
						</p>
						<button
							type="button"
							onClick={() => startSignIn()}
							className="w-full rounded-xl bg-white text-black hover:bg-zinc-200 py-3 text-sm font-semibold transition cursor-pointer"
						>
							Continue with Concord ID
						</button>
					</div>
				)}
			</div>
		</main>
	)
}
