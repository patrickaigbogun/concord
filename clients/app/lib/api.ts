import { CONCORD_CONFIG } from './config'
import { getSession } from './auth'

export type EchoPolicy = 'space_only' | 'realm_only' | 'universal'

export interface ApiRealm {
	id: string
	name: string
	slug: string
	description?: string | null
	icon_url?: string | null
	banner_url?: string | null
	owner_id?: string
	created_at?: string
	updated_at?: string
	spaces?: ApiSpace[]
}

export interface ApiSpace {
	id: string
	realm_id: string
	name: string
	slug: string
	description?: string | null
	kind?: string
	icon_url?: string | null
	created_at?: string
	updated_at?: string
}

export interface ApiSpaceMembership {
	id?: string
	space_id: string
	user_id?: string
	tag?: string | null
	display_name?: string | null
	avatar_url?: string | null
	is_anonymous?: boolean
	role?: string
	joined_at?: string
}

export interface ApiReaction {
	id?: string
	message_id: string
	emoji: string
	user_id?: string
	count?: number
	created_at?: string
}

export interface ApiAuthor {
	id?: string
	username?: string
	display_name?: string
	avatar_url?: string | null
}

export interface ApiMessage {
	id: string
	space_id: string
	author_id: string
	author?: ApiAuthor
	author_name?: string
	author_handle?: string
	author_avatar?: string | null
	content: string
	type?: string
	reply_to_id?: string | null
	reactions?: ApiReaction[]
	inserted_at?: string
	created_at?: string
	updated_at?: string
}

export interface ApiPost {
	id: string
	space_id: string
	author_id?: string
	author?: ApiAuthor
	author_name?: string
	author_handle?: string
	title: string
	body: string
	excerpt?: string
	echo_policy?: EchoPolicy | string
	echo_count?: number
	comment_count?: number
	published_at?: string
	inserted_at?: string
	created_at?: string
}

export interface ApiComment {
	id: string
	post_id: string
	author_id?: string
	author?: ApiAuthor
	author_name?: string
	author_handle?: string
	content: string
	inserted_at?: string
	created_at?: string
}

export interface ApiFileAsset {
	id: string
	space_id: string
	filename: string
	content_type: string
	size_bytes: number
	url: string
	inserted_at?: string
	created_at?: string
}

export interface CreateRealmParams {
	name: string
	slug: string
	description?: string
	icon_url?: string
	banner_url?: string
}

export interface CreateSpaceParams {
	realm_id: string
	name: string
	slug: string
	description?: string
	kind?: string
}

export interface UpdateSpaceIdentityParams {
	tag?: string
	display_name?: string
	avatar_url?: string
	is_anonymous?: boolean
}

export interface FetchMessagesOptions {
	before?: string
	limit?: number
}

export interface SendMessageParams {
	content: string
	reply_to_id?: string
	type?: string
}

export interface CreatePostParams {
	title: string
	body: string
	echo_policy?: EchoPolicy | string
}

export interface RegisterFileAssetParams {
	filename: string
	content_type: string
	size_bytes: number
	url: string
}

export class ApiError extends Error {
	readonly status: number
	readonly details?: unknown

	constructor(message: string, status: number, details?: unknown) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.details = details
	}
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
	const base = CONCORD_CONFIG.gatewayUrl.replace(/\/+$/, '')
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	const url = new URL(`${base}${normalizedPath}`)
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== '') {
				url.searchParams.set(key, String(value))
			}
		}
	}
	return url.toString()
}

async function gatewayRequest<T>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	path: string,
	options?: {
		query?: Record<string, string | number | undefined>
		body?: unknown
	},
): Promise<T> {
	const session = getSession()
	const headers: Record<string, string> = {
		Accept: 'application/json',
	}

	if (session?.access_token) {
		headers.Authorization = `Bearer ${session.access_token}`
	}

	let serializedBody: string | undefined
	if (options?.body !== undefined) {
		headers['Content-Type'] = 'application/json'
		serializedBody = JSON.stringify(options.body)
	}

	const resp = await fetch(buildUrl(path, options?.query), {
		method,
		headers,
		body: serializedBody,
	})

	if (!resp.ok) {
		let message = `Request failed (${resp.status})`
		let details: unknown
		const text = await resp.text().catch(() => '')
		if (text) {
			try {
				const parsed = JSON.parse(text)
				details = parsed
				if (parsed?.error || parsed?.message) {
					message = parsed.error || parsed.message
				} else if (parsed?.errors && typeof parsed.errors === 'object') {
					const first = Object.entries(parsed.errors as Record<string, unknown>)[0]
					if (first) {
						const val = Array.isArray(first[1]) ? first[1][0] : first[1]
						message = `${first[0]}: ${String(val)}`
					}
				}
			} catch {
				message = text
			}
		}
		throw new ApiError(message, resp.status, details)
	}

	if (resp.status === 204) {
		return undefined as T
	}

	const text = await resp.text()
	if (!text) {
		return undefined as T
	}

	return JSON.parse(text) as T
}

function unwrapList<T>(payload: T[] | { data?: T[] } | null | undefined): T[] {
	if (Array.isArray(payload)) return payload
	if (payload && Array.isArray(payload.data)) return payload.data
	return []
}

function unwrapItem<T>(payload: T | { data: T }): T {
	if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: T }).data !== undefined) {
		return (payload as { data: T }).data
	}
	return payload as T
}

// ---------------------------------------------------------------------------
// Realms
// ---------------------------------------------------------------------------

export async function fetchRealms(): Promise<ApiRealm[]> {
	const res = await gatewayRequest<ApiRealm[] | { data?: ApiRealm[] }>('GET', '/api/v1/realms')
	return unwrapList(res)
}

export async function createRealm(params: CreateRealmParams): Promise<ApiRealm> {
	const res = await gatewayRequest<ApiRealm | { data: ApiRealm }>('POST', '/api/v1/realms', {
		body: params,
	})
	return unwrapItem(res)
}

// ---------------------------------------------------------------------------
// Spaces & Contextual Identity
// ---------------------------------------------------------------------------

export async function fetchSpaces(realmId?: string): Promise<ApiSpace[]> {
	const res = await gatewayRequest<ApiSpace[] | { data?: ApiSpace[] }>('GET', '/api/v1/spaces', {
		query: realmId ? { realm_id: realmId } : undefined,
	})
	return unwrapList(res)
}

export async function createSpace(params: CreateSpaceParams): Promise<ApiSpace> {
	const res = await gatewayRequest<ApiSpace | { data: ApiSpace }>('POST', '/api/v1/spaces', {
		body: params,
	})
	return unwrapItem(res)
}

export async function joinSpace(spaceId: string, tag?: string): Promise<ApiSpaceMembership> {
	const res = await gatewayRequest<ApiSpaceMembership | { data: ApiSpaceMembership }>(
		'POST',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/join`,
		{
			body: tag ? { tag } : {},
		},
	)
	return unwrapItem(res)
}

export async function updateSpaceIdentity(
	spaceId: string,
	params: UpdateSpaceIdentityParams,
): Promise<ApiSpaceMembership> {
	const res = await gatewayRequest<ApiSpaceMembership | { data: ApiSpaceMembership }>(
		'PUT',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/identity`,
		{
			body: params,
		},
	)
	return unwrapItem(res)
}

// ---------------------------------------------------------------------------
// Messages & Reactions
// ---------------------------------------------------------------------------

export async function fetchMessages(
	spaceId: string,
	opts?: FetchMessagesOptions,
): Promise<ApiMessage[]> {
	const res = await gatewayRequest<ApiMessage[] | { data?: ApiMessage[] }>(
		'GET',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/messages`,
		{
			query: opts ? { before: opts.before, limit: opts.limit } : undefined,
		},
	)
	return unwrapList(res)
}

export async function sendMessage(
	spaceId: string,
	params: SendMessageParams,
): Promise<ApiMessage> {
	const res = await gatewayRequest<ApiMessage | { data: ApiMessage }>(
		'POST',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/messages`,
		{
			body: params,
		},
	)
	return unwrapItem(res)
}

export async function addReaction(messageId: string, emoji: string): Promise<ApiReaction> {
	const res = await gatewayRequest<ApiReaction | { data: ApiReaction }>(
		'POST',
		`/api/v1/messages/${encodeURIComponent(messageId)}/reactions`,
		{
			body: { emoji },
		},
	)
	return unwrapItem(res)
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
	await gatewayRequest<void>(
		'DELETE',
		`/api/v1/messages/${encodeURIComponent(messageId)}/reactions`,
		{
			query: { emoji },
		},
	)
}

// ---------------------------------------------------------------------------
// Posts, Echoes & Comments
// ---------------------------------------------------------------------------

export async function fetchPosts(spaceId: string): Promise<ApiPost[]> {
	const res = await gatewayRequest<ApiPost[] | { data?: ApiPost[] }>(
		'GET',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/posts`,
	)
	return unwrapList(res)
}

export async function createPost(spaceId: string, params: CreatePostParams): Promise<ApiPost> {
	const res = await gatewayRequest<ApiPost | { data: ApiPost }>(
		'POST',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/posts`,
		{
			body: params,
		},
	)
	return unwrapItem(res)
}

export async function echoPost(postId: string, destinationSpaceId: string): Promise<ApiPost> {
	const res = await gatewayRequest<ApiPost | { data: ApiPost }>(
		'POST',
		`/api/v1/posts/${encodeURIComponent(postId)}/echo`,
		{
			body: { destination_space_id: destinationSpaceId },
		},
	)
	return unwrapItem(res)
}

export async function fetchComments(postId: string): Promise<ApiComment[]> {
	const res = await gatewayRequest<ApiComment[] | { data?: ApiComment[] }>(
		'GET',
		`/api/v1/posts/${encodeURIComponent(postId)}/comments`,
	)
	return unwrapList(res)
}

export async function createComment(postId: string, content: string): Promise<ApiComment> {
	const res = await gatewayRequest<ApiComment | { data: ApiComment }>(
		'POST',
		`/api/v1/posts/${encodeURIComponent(postId)}/comments`,
		{
			body: { content },
		},
	)
	return unwrapItem(res)
}

// ---------------------------------------------------------------------------
// Files & Media
// ---------------------------------------------------------------------------

export async function fetchFiles(spaceId: string): Promise<ApiFileAsset[]> {
	const res = await gatewayRequest<ApiFileAsset[] | { data?: ApiFileAsset[] }>(
		'GET',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/files`,
	)
	return unwrapList(res)
}

export async function fetchMedia(spaceId: string): Promise<ApiFileAsset[]> {
	const res = await gatewayRequest<ApiFileAsset[] | { data?: ApiFileAsset[] }>(
		'GET',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/media`,
	)
	return unwrapList(res)
}

export async function registerFileAsset(
	spaceId: string,
	asset: RegisterFileAssetParams,
): Promise<ApiFileAsset> {
	const res = await gatewayRequest<ApiFileAsset | { data: ApiFileAsset }>(
		'POST',
		`/api/v1/spaces/${encodeURIComponent(spaceId)}/files`,
		{
			body: asset,
		},
	)
	return unwrapItem(res)
}
