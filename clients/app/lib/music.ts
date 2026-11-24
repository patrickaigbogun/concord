export interface MusicTrack {
	id: string
	title: string
	artist: string
	album?: string
	artworkUrl?: string
	previewUrl: string
	externalUrl?: string
	durationSec?: number
	source: 'itunes' | 'upload'
}

interface ItunesSongResult {
	trackId?: number
	trackName?: string
	artistName?: string
	collectionName?: string
	artworkUrl100?: string
	artworkUrl60?: string
	artworkUrl30?: string
	previewUrl?: string
	trackViewUrl?: string
	trackTimeMillis?: number
}

interface ItunesSearchResponse {
	resultCount?: number
	results?: ItunesSongResult[]
}

const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search'

function isValidHttpsUrl(value: unknown): value is string {
	if (typeof value !== 'string') return false
	try {
		return new URL(value.trim()).protocol === 'https:'
	} catch {
		return false
	}
}

export async function searchSongs(query: string, signal?: AbortSignal): Promise<MusicTrack[]> {
	const trimmed = query.trim()
	if (!trimmed) return []

	try {
		const params = new URLSearchParams({
			term: trimmed,
			media: 'music',
			entity: 'song',
			limit: '10',
		})

		const resp = await fetch(`${ITUNES_SEARCH_ENDPOINT}?${params.toString()}`, {
			method: 'GET',
			signal,
		})

		if (!resp.ok) {
			return []
		}

		const data = (await resp.json()) as ItunesSearchResponse
		if (!Array.isArray(data.results)) {
			return []
		}

		const tracks: MusicTrack[] = []
		for (let i = 0; i < data.results.length; i++) {
			const item = data.results[i]
			if (!isValidHttpsUrl(item.previewUrl)) continue

			const artwork = item.artworkUrl100 || item.artworkUrl60 || item.artworkUrl30
			const durationSec =
				typeof item.trackTimeMillis === 'number' && item.trackTimeMillis > 0
					? Math.round(item.trackTimeMillis / 1000)
					: undefined

			tracks.push({
				id: item.trackId ? String(item.trackId) : `itunes-${i}-${item.trackName || 'track'}`,
				title: item.trackName?.trim() || 'Untitled',
				artist: item.artistName?.trim() || 'Unknown Artist',
				album: item.collectionName?.trim() || undefined,
				artworkUrl: isValidHttpsUrl(artwork) ? artwork.trim() : undefined,
				previewUrl: item.previewUrl.trim(),
				externalUrl: isValidHttpsUrl(item.trackViewUrl) ? item.trackViewUrl.trim() : undefined,
				durationSec,
				source: 'itunes',
			})
		}

		return tracks
	} catch {
		return []
	}
}
