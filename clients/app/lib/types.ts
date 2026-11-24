export const MAX_FREE_SPACES_PER_REALM = 7

export type RoomViewMode = 'grid-titled' | 'grid-visual' | 'list'

export interface RealmNote {
	text: string
	curatorName: string
	audioTitle?: string
	audioArtist?: string
	audioUrl?: string
	audioArtworkUrl?: string
	audioExternalUrl?: string
	updatedAt: string
}

export interface Realm {
	id: string
	name: string
	slug: string
	description?: string
	coverUrl: string
	accentColor: string
	isDirect?: boolean
	unreadCount?: number
	note?: RealmNote
	spaces: Space[]
}

export interface Space {
	id: string
	realmId: string
	name: string
	slug: string
	description?: string
	orbImage?: string
	orbGradient: string
	kind: 'direct' | 'group' | 'community' | 'organization'
	unread?: boolean
}

export interface ChatMessage {
	id: string
	spaceId: string
	authorId: string
	authorName: string
	authorHandle: string
	authorAvatar?: string
	isSelf?: boolean
	content: string
	replyTo?: {
		id: string
		authorName: string
		excerpt: string
	}
	attachment?: FileAsset
	reactions?: { emoji: string; count: number; reacted?: boolean }[]
	createdAt: string
}

export interface SeriesPost {
	id: string
	spaceId: string
	title: string
	excerpt: string
	body: string
	authorName: string
	authorHandle: string
	issueNumber?: number
	echoCount: number
	commentCount: number
	publishedAt: string
}

export interface FileAsset {
	id: string
	spaceId: string
	filename: string
	contentType: string
	sizeBytes: number
	url: string
	kind: 'image' | 'doc' | 'audio' | 'video' | 'link'
	previewText?: string
	createdAt: string
}

/**
 * Formats a Space name for its circular orb label:
 * - Multiple words -> initials (up to 3 chars, e.g. "Book Club" -> "BC", "Late Night Notes" -> "LNN")
 * - Single word <= 5 letters -> full word (e.g. "Ideas" -> "Ideas", "Draft" -> "Draft")
 * - Single word > 5 letters -> cleanly truncated (e.g. "Typography" -> "Typo…")
 */
export function formatOrbLabel(name: string): string {
	const trimmed = name.trim()
	if (!trimmed) return '•'

	const words = trimmed.split(/\s+/).filter(Boolean)
	if (words.length > 1) {
		return words
			.slice(0, 3)
			.map((w) => w[0]?.toUpperCase() || '')
			.join('')
	}

	const single = words[0]
	if (single.length <= 5) {
		return single
	}
	return `${single.slice(0, 4)}…`
}
