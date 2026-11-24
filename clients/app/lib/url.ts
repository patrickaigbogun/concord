import { CONCORD_CONFIG } from './config'

let cachedStorageOrigin: string | null = null
function getStorageOrigin(): string {
	if (!cachedStorageOrigin) {
		try {
			cachedStorageOrigin = new URL(CONCORD_CONFIG.storageUrl).origin
		} catch {
			cachedStorageOrigin = 'https://r2.concord.dexx.systems'
		}
	}
	return cachedStorageOrigin
}

/**
 * Allows only valid https:// URLs (rejects javascript:, data:, http:, etc.).
 */
export function safeHttpsUrl(raw?: string | null): string | null {
	if (!raw || typeof raw !== 'string') return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const parsed = new URL(trimmed)
		if (parsed.protocol === 'https:') {
			return parsed.toString()
		}
		return null
	} catch {
		return null
	}
}

/**
 * Allows https:// URLs or local blob: URLs (for client-side media previews).
 */
export function safeMediaUrl(raw?: string | null): string | null {
	if (!raw || typeof raw !== 'string') return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const parsed = new URL(trimmed)
		if (parsed.protocol === 'https:' || parsed.protocol === 'blob:') {
			return parsed.toString()
		}
		return null
	} catch {
		return null
	}
}

/**
 * Strictly allows only Concord R2 storage URLs (https://r2.concord.dexx.systems)
 * or local blob: URLs — required for PDF <iframe> embedding.
 */
export function safeStorageUrl(raw?: string | null, allowBlob = false): string | null {
	if (!raw || typeof raw !== 'string') return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const parsed = new URL(trimmed)
		if (allowBlob && parsed.protocol === 'blob:') {
			return parsed.toString()
		}
		if (parsed.protocol === 'https:' && parsed.origin === getStorageOrigin()) {
			return parsed.toString()
		}
		return null
	} catch {
		return null
	}
}

export function isUuid(value?: string | null): boolean {
	if (!value) return false
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
