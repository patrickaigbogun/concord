export const CONCORD_CONFIG = {
	idUrl: (globalThis as any).__CONCORD_ID_URL__ || 'https://id.dexx.systems',
	gatewayUrl: (globalThis as any).__CONCORD_GATEWAY_URL__ || 'https://gateway.concord.dexx.systems',
	storageUrl: (globalThis as any).__CONCORD_STORAGE_URL__ || 'https://r2.concord.dexx.systems',
	clientId: 'concord_app',
} as const

export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function getRedirectUri(): string {
	if (isTauri()) {
		return 'concord://auth/callback'
	}
	if (typeof window !== 'undefined') {
		return `${window.location.origin}/auth/callback`
	}
	return 'http://localhost:7990/auth/callback'
}
