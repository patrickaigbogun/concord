import { CONCORD_CONFIG, getRedirectUri, isTauri } from './config'

export interface ConcordUser {
	id: string
	username: string
	display_name: string
	email: string
	avatar_url?: string
}

export interface ConcordSession {
	access_token: string
	refresh_token?: string
	expires_at: number
	user: ConcordUser
}

const SESSION_KEY = 'concord_session_v1'
const VERIFIER_KEY = 'concord_pkce_verifier'
const STATE_KEY = 'concord_oauth_state'

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	const random = new Uint8Array(32)
	crypto.getRandomValues(random)
	const verifier = base64UrlEncode(random)
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
	const challenge = base64UrlEncode(new Uint8Array(digest))
	return { verifier, challenge }
}

export function getSession(): ConcordSession | null {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(SESSION_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as ConcordSession
		if (parsed?.expires_at && Date.now() >= parsed.expires_at) {
			localStorage.removeItem(SESSION_KEY)
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export function saveSession(session: ConcordSession): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(SESSION_KEY, JSON.stringify(session))
	}
}

export function clearSession(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(SESSION_KEY)
	}
}

export async function startSignIn(): Promise<void> {
	const { verifier, challenge } = await generatePKCE()
	const stateBytes = new Uint8Array(16)
	crypto.getRandomValues(stateBytes)
	const state = base64UrlEncode(stateBytes)

	localStorage.setItem(VERIFIER_KEY, verifier)
	localStorage.setItem(STATE_KEY, state)

	const params = new URLSearchParams({
		client_id: CONCORD_CONFIG.clientId,
		redirect_uri: getRedirectUri(),
		response_type: 'code',
		scope: 'openid profile email',
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256',
	})

	const authUrl = `${CONCORD_CONFIG.idUrl}/oauth/authorize?${params.toString()}`

	if (isTauri()) {
		const { openUrl } = await import('@tauri-apps/plugin-opener')
		await openUrl(authUrl)
	} else {
		window.location.href = authUrl
	}
}

export async function completeSignIn(callbackUrl: string): Promise<ConcordSession> {
	const parsed = new URL(callbackUrl)
	const code = parsed.searchParams.get('code')
	const state = parsed.searchParams.get('state')

	const expectedState = localStorage.getItem(STATE_KEY)
	const verifier = localStorage.getItem(VERIFIER_KEY)

	if (!code) throw new Error('Missing authorization code')
	if (!expectedState || state !== expectedState) throw new Error('OAuth state mismatch')

	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: CONCORD_CONFIG.clientId,
		redirect_uri: getRedirectUri(),
		code,
		code_verifier: verifier || '',
	})

	const resp = await fetch(`${CONCORD_CONFIG.idUrl}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	})

	if (!resp.ok) {
		const errText = await resp.text()
		throw new Error(`Token exchange failed: ${errText}`)
	}

	const data = await resp.json()
	const session: ConcordSession = {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires_at: Date.now() + (data.expires_in || 86400) * 1000,
		user: data.user,
	}

	localStorage.removeItem(VERIFIER_KEY)
	localStorage.removeItem(STATE_KEY)
	saveSession(session)
	return session
}

export async function listenForTauriDeepLink(onSession: (session: ConcordSession) => void): Promise<() => void> {
	if (!isTauri()) return () => {}
	const { listen } = await import('@tauri-apps/api/event')
	const unlisten = await listen<string[]>('concord://deep-link', async (event) => {
		const url = event.payload?.[0]
		if (url && url.startsWith('concord://auth/callback')) {
			const session = await completeSignIn(url)
			onSession(session)
		}
	})
	return unlisten
}
