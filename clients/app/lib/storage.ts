import { CONCORD_CONFIG } from './config'
import { getSession } from './auth'
import { safeStorageUrl } from './url'

export interface UploadedAsset {
	id: string
	filename: string
	content_type: string
	size_bytes: number
	url: string
	sha256: string
	backend: string
	created_at: string
}

export async function uploadFile(file: File, spaceId?: string): Promise<UploadedAsset> {
	const session = getSession()
	if (!session?.access_token) {
		throw new Error('Sign in with Concord ID before uploading files')
	}

	const form = new FormData()
	form.append('file', file)
	if (spaceId) {
		form.append('space_id', spaceId)
	}

	const resp = await fetch(`${CONCORD_CONFIG.storageUrl}/upload`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${session.access_token}`,
		},
		body: form,
	})

	if (!resp.ok) {
		throw new Error(`Upload failed (${resp.status})`)
	}

	const data = (await resp.json()) as UploadedAsset
	const verifiedUrl = safeStorageUrl(data?.url, false)
	if (!verifiedUrl) {
		throw new Error('Upload response returned an untrusted storage URL')
	}
	return { ...data, url: verifiedUrl }
}
