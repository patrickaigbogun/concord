import { useEffect, useState } from 'react'
import { completeSignIn } from '../../../lib/auth'
import { isTauri } from '../../../lib/config'

export const metadata = { title: 'Signing in — Concord' }

export default function AuthCallbackPage() {
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		completeSignIn(window.location.href)
			.then(() => {
				window.location.href = isTauri() ? '/' : '/app'
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : 'Sign-in failed')
			})
	}, [])

	return (
		<main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
			<div className="max-w-sm w-full rounded-2xl border border-white/10 bg-[#121215] p-6 text-center space-y-3">
				<h1 className="text-lg font-semibold">Concord ID</h1>
				{error ? (
					<p className="text-sm text-red-400">{error}</p>
				) : (
					<p className="text-sm text-zinc-400">Completing sign-in...</p>
				)}
			</div>
		</main>
	)
}
