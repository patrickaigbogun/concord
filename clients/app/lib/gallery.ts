export interface NativeGalleryItem {
	id: string
	uri: string
	filename: string
	mimeType: string
	kind: 'image' | 'video'
	thumbnailDataUrl: string
	sizeBytes: number
}

interface ConcordGalleryBridge {
	hasPermission(): boolean
	requestPermission(): void
	listMedia(limit: number, offset: number): string
	readMediaBase64(uriStr: string): string
}

declare global {
	interface Window {
		ConcordGallery?: ConcordGalleryBridge
		__concordGalleryPermResult?: (granted: boolean) => void
	}
}

let inFlightPermissionRequest: Promise<boolean> | null = null

export function hasNativeGallery(): boolean {
	return typeof window !== 'undefined' && Boolean(window.ConcordGallery)
}

export function hasGalleryPermission(): boolean {
	if (!hasNativeGallery()) return false
	try {
		return Boolean(window.ConcordGallery!.hasPermission())
	} catch {
		return false
	}
}

export function requestGalleryPermission(timeoutMs = 30000): Promise<boolean> {
	if (!hasNativeGallery()) return Promise.resolve(false)
	if (hasGalleryPermission()) return Promise.resolve(true)
	if (inFlightPermissionRequest) return inFlightPermissionRequest

	inFlightPermissionRequest = new Promise<boolean>((resolve) => {
		let settled = false
		const prevCallback = window.__concordGalleryPermResult

		const cleanup = () => {
			if (pollTimer !== null) {
				clearInterval(pollTimer)
				pollTimer = null
			}
			if (timeoutTimer !== null) {
				clearTimeout(timeoutTimer)
				timeoutTimer = null
			}
			if (window.__concordGalleryPermResult === handleResult) {
				window.__concordGalleryPermResult = prevCallback
			}
			inFlightPermissionRequest = null
		}

		const finish = (granted: boolean) => {
			if (settled) return
			settled = true
			cleanup()
			resolve(granted)
		}

		const handleResult = (granted: boolean) => {
			finish(Boolean(granted) || hasGalleryPermission())
		}

		let pollTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
			if (hasGalleryPermission()) {
				finish(true)
			}
		}, 500)

		let timeoutTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
			finish(hasGalleryPermission())
		}, timeoutMs)

		window.__concordGalleryPermResult = handleResult

		try {
			window.ConcordGallery!.requestPermission()
		} catch {
			finish(false)
		}
	})

	return inFlightPermissionRequest
}

export async function loadNativeGallery(limit = 48, offset = 0): Promise<NativeGalleryItem[]> {
	if (!hasNativeGallery()) return []
	// Yield a micro-tick so React can paint loading state before synchronous JNI query
	await new Promise((r) => setTimeout(r, 0))
	try {
		const raw = window.ConcordGallery!.listMedia(limit, offset)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		if (!Array.isArray(parsed)) return []
		return parsed
			.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
			.map((entry, idx) => ({
				id: String(entry.id ?? `native-${offset + idx}`),
				uri: String(entry.uri ?? ''),
				filename: String(entry.filename ?? 'media'),
				mimeType: String(entry.mimeType ?? (entry.kind === 'video' ? 'video/mp4' : 'image/jpeg')),
				kind: (entry.kind === 'video' ? 'video' : 'image') as 'image' | 'video',
				thumbnailDataUrl: String(entry.thumbnailDataUrl ?? ''),
				sizeBytes: typeof entry.sizeBytes === 'number' && Number.isFinite(entry.sizeBytes) ? entry.sizeBytes : 0,
			}))
			.filter((item) => Boolean(item.uri))
	} catch {
		return []
	}
}

const MAX_NATIVE_BRIDGE_BYTES = 25 * 1024 * 1024

export async function readNativeMediaAsFile(item: NativeGalleryItem): Promise<File> {
	if (!hasNativeGallery()) {
		throw new Error('Native gallery bridge is unavailable')
	}
	if (item.sizeBytes > MAX_NATIVE_BRIDGE_BYTES) {
		throw new Error('File exceeds 25 MB inline gallery limit — use the Gallery button to pick large videos.')
	}
	await new Promise((r) => setTimeout(r, 0))
	const rawBase64 = window.ConcordGallery!.readMediaBase64(item.uri)
	if (!rawBase64) {
		throw new Error('Could not read media from device storage')
	}

	const commaIdx = rawBase64.indexOf(',')
	const base64 = commaIdx >= 0 ? rawBase64.slice(commaIdx + 1) : rawBase64
	const binary = atob(base64)
	const len = binary.length
	const bytes = new Uint8Array(len)
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i)
	}

	const mimeType = item.mimeType || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg')
	const fallbackExt = item.kind === 'video' ? 'mp4' : 'jpg'
	const filename = item.filename || `media-${item.id}.${fallbackExt}`
	const blob = new Blob([bytes], { type: mimeType })
	return new File([blob], filename, { type: mimeType })
}
