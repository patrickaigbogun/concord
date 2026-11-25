import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { MAX_FREE_SPACES_PER_REALM } from '../../lib/types'
import { uploadFile } from '../../lib/storage'
import {
	createPost,
	createRealm,
	createSpace,
	updateSpaceIdentity,
	type ApiPost,
	type ApiRealm,
	type ApiSpace,
	type EchoPolicy,
} from '../../lib/api'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

function sanitizeTag(value: string): string {
	return value
		.toLowerCase()
		.replace(/^@+/, '')
		.replace(/[^a-z0-9._-]/g, '')
		.slice(0, 32)
}

// ---------------------------------------------------------------------------
// Crisp Inline SVGs (zero Unicode/HTML arrows or symbols)
// ---------------------------------------------------------------------------

function CloseIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M18 6L6 18" />
			<path d="M6 6l12 12" />
		</svg>
	)
}

function UploadCloudIcon({ className = 'w-5 h-5' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M12 16V8" />
			<path d="M8.5 11.5L12 8l3.5 3.5" />
			<path d="M20 16.5A4.5 4.5 0 0017.5 8h-1.2A6 6 0 104 14.2" />
		</svg>
	)
}

function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<rect x="4" y="11" width="16" height="10" rx="2.5" />
			<path d="M8 11V7a4 4 0 018 0v4" />
		</svg>
	)
}

function LayersIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
			<path d="M3 12l9 4.5 9-4.5" />
			<path d="M3 16.5L12 21l9-4.5" />
		</svg>
	)
}

function GlobeIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="9" />
			<path d="M3.6 9h16.8" />
			<path d="M3.6 15h16.8" />
			<path d="M12 3a13.5 13.5 0 010 18" />
			<path d="M12 3a13.5 13.5 0 000 18" />
		</svg>
	)
}

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
			<path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z" />
		</svg>
	)
}

function MaskIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M4 9c0-2 3.5-3.5 8-3.5s8 1.5 8 3.5v2.5c0 4-3.5 7-8 7s-8-3-8-7V9z" />
			<circle cx="9.2" cy="11.5" r="1.2" />
			<circle cx="14.8" cy="11.5" r="1.2" />
		</svg>
	)
}

function CheckIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	)
}

function SpinnerIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
			<path className="opacity-90" d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
		</svg>
	)
}

// ---------------------------------------------------------------------------
// Shared Obsidian Modal Shell
// ---------------------------------------------------------------------------

interface ModalShellProps {
	eyebrow: string
	title: string
	subtitle?: string
	maxWidthClass?: string
	onClose: () => void
	children: ReactNode
}

function ModalShell({
	eyebrow,
	title,
	subtitle,
	maxWidthClass = 'sm:max-w-lg',
	onClose,
	children,
}: ModalShellProps) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	return (
		<div
			className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			role="dialog"
			aria-modal="true"
		>
			<div
				className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-[#101014] border border-white/10 shadow-2xl`}
			>
				<div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-white/[0.07]">
					<div className="min-w-0">
						<div className="text-[10px] text-[#c4b5fd] font-semibold">
							{eyebrow}
						</div>
						<h2 className="text-lg font-bold text-white tracking-tight mt-0.5">{title}</h2>
						{subtitle && <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close modal"
						className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>
				<div className="p-5">{children}</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// 1. CreateRealmModal
// ---------------------------------------------------------------------------

export interface CreateRealmModalProps {
	onClose: () => void
	onCreated?: (realm: ApiRealm) => void
	onSubmit?: (params: {
		name: string
		slug: string
		description?: string
		banner_url?: string
	}) => Promise<ApiRealm | void> | void
}

export function CreateRealmModal({ onClose, onCreated, onSubmit }: CreateRealmModalProps) {
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
	const [coverPreview, setCoverPreview] = useState<string | null>(null)
	const [uploading, setUploading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const coverUploadSeqRef = useRef(0)

	useEffect(() => {
		return () => {
			if (coverPreview?.startsWith('blob:')) {
				URL.revokeObjectURL(coverPreview)
			}
		}
	}, [coverPreview])

	const derivedSlug = slugify(name)

	const handleCoverChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (!file.type.startsWith('image/')) {
			setError('Please choose an image file for the Realm cover.')
			return
		}

		const seq = ++coverUploadSeqRef.current
		setError(null)
		const localUrl = URL.createObjectURL(file)
		setCoverPreview(localUrl)
		setUploading(true)

		try {
			const uploaded = await uploadFile(file)
			if (coverUploadSeqRef.current !== seq) return
			setCoverUrl(uploaded.url)
		} catch (err) {
			if (coverUploadSeqRef.current !== seq) return
			setCoverUrl(undefined)
			setError(err instanceof Error ? err.message : 'Cover upload failed')
		} finally {
			if (coverUploadSeqRef.current === seq) {
				setUploading(false)
			}
		}
	}

	const handleClearCover = () => {
		coverUploadSeqRef.current += 1
		setUploading(false)
		setCoverUrl(undefined)
		setCoverPreview(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		const trimmedName = name.trim()
		if (!trimmedName) {
			setError('Realm name is required.')
			return
		}
		if (uploading) return

		setSubmitting(true)
		setError(null)
		try {
			const payload = {
				name: trimmedName,
				slug: derivedSlug || `realm-${Date.now().toString(36)}`,
				description: description.trim() || undefined,
				banner_url: coverUrl,
			}

			const created = onSubmit ? await onSubmit(payload) : await createRealm(payload)
			if (created) {
				onCreated?.(created)
			}
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not create Realm')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<ModalShell
			eyebrow="New Realm"
			title="Create a Realm"
			subtitle="A home for your Spaces, essays, and shared media."
			onClose={onClose}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Cover Image Upload */}
				<div className="space-y-2">
					<label className="block text-[11px] font-semibold text-zinc-400">
						Cover Image
					</label>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handleCoverChange}
						className="hidden"
					/>
					{coverPreview ? (
						<div className="relative h-36 rounded-2xl overflow-hidden border border-white/10 bg-[#15151b]">
							<img src={coverPreview} alt="Realm cover preview" className="w-full h-full object-cover" />
							<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
							<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
								<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-[11px] font-medium text-zinc-100">
									{uploading ? (
										<>
											<SpinnerIcon className="w-3.5 h-3.5 text-[#a78bfa]" />
											Uploading to R2...
										</>
									) : coverUrl ? (
										<>
											<CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
											Uploaded
										</>
									) : (
										'Upload failed'
									)}
								</span>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 border border-white/15 text-[11px] font-medium text-white cursor-pointer transition"
									>
										Replace
									</button>
									<button
										type="button"
										onClick={handleClearCover}
										className="px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 border border-white/15 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer transition"
									>
										Remove
									</button>
								</div>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="w-full h-32 rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-[#8b5cf6]/[0.06] flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
						>
							<div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#c4b5fd]">
								<UploadCloudIcon className="w-5 h-5" />
							</div>
							<div className="text-xs font-medium">Upload cover artwork</div>
							<div className="text-[11px] text-zinc-500">PNG, JPG, or WebP stored on Concord R2</div>
						</button>
					)}
				</div>

				{/* Realm Name */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label htmlFor="realm-name" className="text-[11px] font-semibold text-zinc-400">
							Name
						</label>
						{derivedSlug && (
							<span className="text-[11px] font-mono text-zinc-500">/{derivedSlug}</span>
						)}
					</div>
					<input
						id="realm-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Night Reading Collective"
						maxLength={64}
						autoFocus
						className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm text-white placeholder:text-zinc-500 transition"
					/>
				</div>

				{/* Description */}
				<div className="space-y-1.5">
					<label htmlFor="realm-description" className="block text-[11px] font-semibold text-zinc-400">
						Description
					</label>
					<textarea
						id="realm-description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What brings people together in this Realm?"
						rows={3}
						maxLength={280}
						className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm text-white placeholder:text-zinc-500 resize-none transition"
					/>
				</div>

				{error && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
						{error}
					</div>
				)}

				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer transition"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting || uploading || !name.trim()}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 cursor-pointer transition"
					>
						{submitting && <SpinnerIcon className="w-3.5 h-3.5" />}
						Create Realm
					</button>
				</div>
			</form>
		</ModalShell>
	)
}

// ---------------------------------------------------------------------------
// 2. CreateSpaceModal
// ---------------------------------------------------------------------------

export interface CreateSpaceModalProps {
	realmId: string
	realmName?: string
	currentSpaceCount: number
	onClose: () => void
	onCreated?: (space: ApiSpace) => void
	onUpgradeClick?: () => void
	onSubmit?: (params: {
		realm_id: string
		name: string
		slug: string
		description?: string
		kind?: string
	}) => Promise<ApiSpace | void> | void
}

export function CreateSpaceModal({
	realmId,
	realmName,
	currentSpaceCount,
	onClose,
	onCreated,
	onUpgradeClick,
	onSubmit,
}: CreateSpaceModalProps) {
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const limitReached = currentSpaceCount >= MAX_FREE_SPACES_PER_REALM
	const derivedSlug = slugify(name)

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (limitReached) return
		const trimmedName = name.trim()
		if (!trimmedName) {
			setError('Space name is required.')
			return
		}

		setSubmitting(true)
		setError(null)
		try {
			const payload = {
				realm_id: realmId,
				name: trimmedName,
				slug: derivedSlug || `space-${Date.now().toString(36)}`,
				description: description.trim() || undefined,
				kind: 'group',
			}

			const created = onSubmit ? await onSubmit(payload) : await createSpace(payload)
			if (created) {
				onCreated?.(created)
			}
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not create Space')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<ModalShell
			eyebrow={realmName ? `${realmName} / Spaces` : 'New Space'}
			title="Create a Space"
			subtitle="A focused Space for conversation, long-form Series, and shared files."
			onClose={onClose}
		>
			{/* Space Quota Pill */}
			<div className="mb-4 flex items-center justify-between rounded-2xl bg-[#15151b] border border-white/[0.07] px-3.5 py-2.5">
				<span className="text-xs text-zinc-400">Spaces in this Realm</span>
				<span
					className={`text-xs font-semibold ${
						limitReached ? 'text-amber-300' : 'text-zinc-100'
					}`}
				>
					{currentSpaceCount}/{MAX_FREE_SPACES_PER_REALM}
				</span>
			</div>

			{limitReached ? (
				<div className="space-y-4">
					<div className="rounded-2xl bg-gradient-to-b from-[#8b5cf6]/15 to-[#15151b] border border-[#8b5cf6]/35 p-5 text-center space-y-3">
						<div className="mx-auto w-11 h-11 rounded-2xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#c4b5fd]">
							<SparklesIcon className="w-5 h-5" />
						</div>
						<div>
							<div className="text-sm font-bold text-white">
								{MAX_FREE_SPACES_PER_REALM}/{MAX_FREE_SPACES_PER_REALM} Free Tier Limit Reached
							</div>
							<p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
								Free Realms include up to {MAX_FREE_SPACES_PER_REALM} Spaces to keep communities intentional.
								Upgrade this Realm to unlock unlimited Spaces and expanded media storage.
							</p>
						</div>
						{onUpgradeClick && (
							<button
								type="button"
								onClick={onUpgradeClick}
								className="w-full py-2.5 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/25 cursor-pointer transition"
							>
								Upgrade Realm
							</button>
						)}
					</div>

					<div className="flex justify-end">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer transition"
						>
							Close
						</button>
					</div>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label htmlFor="space-name" className="text-[11px] font-semibold text-zinc-400">
								Name
							</label>
							{derivedSlug && (
								<span className="text-[11px] font-mono text-zinc-500">#{derivedSlug}</span>
							)}
						</div>
						<input
							id="space-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Field Notes"
							maxLength={48}
							autoFocus
							className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm text-white placeholder:text-zinc-500 transition"
						/>
					</div>

					<div className="space-y-1.5">
						<label htmlFor="space-description" className="block text-[11px] font-semibold text-zinc-400">
							Description
						</label>
						<textarea
							id="space-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What happens inside this Space?"
							rows={3}
							maxLength={240}
							className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm text-white placeholder:text-zinc-500 resize-none transition"
						/>
					</div>

					{error && (
						<div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
							{error}
						</div>
					)}

					<div className="flex items-center justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer transition"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={submitting || !name.trim()}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 cursor-pointer transition"
						>
							{submitting && <SpinnerIcon className="w-3.5 h-3.5" />}
							Create Space
						</button>
					</div>
				</form>
			)}
		</ModalShell>
	)
}

// ---------------------------------------------------------------------------
// 3. PublishPostModal
// ---------------------------------------------------------------------------

export interface PublishPostModalProps {
	spaceId: string
	spaceName?: string
	onClose: () => void
	onPublished?: (post: ApiPost) => void
	onSubmit?: (params: {
		title: string
		body: string
		echo_policy: EchoPolicy
	}) => Promise<ApiPost | void> | void
}

const ECHO_POLICY_OPTIONS: {
	value: EchoPolicy
	label: string
	description: string
	icon: (props: { className?: string }) => ReactNode
}[] = [
	{
		value: 'space_only',
		label: 'Space Only',
		description: 'Stays private to this Space.',
		icon: LockIcon,
	},
	{
		value: 'realm_only',
		label: 'Realm Only',
		description: 'Echoable across this Realm.',
		icon: LayersIcon,
	},
	{
		value: 'universal',
		label: 'Universal',
		description: 'Echoable to any Realm.',
		icon: GlobeIcon,
	},
]

export function PublishPostModal({
	spaceId,
	spaceName,
	onClose,
	onPublished,
	onSubmit,
}: PublishPostModalProps) {
	const [title, setTitle] = useState('')
	const [body, setBody] = useState('')
	const [echoPolicy, setEchoPolicy] = useState<EchoPolicy>('realm_only')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		const trimmedTitle = title.trim()
		const trimmedBody = body.trim()
		if (!trimmedTitle) {
			setError('Please add a title for your post.')
			return
		}
		if (!trimmedBody) {
			setError('Please write your post body before publishing.')
			return
		}

		setSubmitting(true)
		setError(null)
		try {
			const payload = {
				title: trimmedTitle,
				body: trimmedBody,
				echo_policy: echoPolicy,
			}

			const published = onSubmit
				? await onSubmit(payload)
				: await createPost(spaceId, payload)
			if (published) {
				onPublished?.(published)
			}
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not publish post')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<ModalShell
			eyebrow={spaceName ? `${spaceName} / Series` : 'Series Post'}
			title="Publish a Post"
			subtitle="Compose in Markdown and choose how far readers can echo it."
			maxWidthClass="sm:max-w-xl"
			onClose={onClose}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Title */}
				<div className="space-y-1.5">
					<label htmlFor="post-title" className="block text-[11px] font-semibold text-zinc-400">
						Title
					</label>
					<input
						id="post-title"
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Give this piece a clear headline"
						maxLength={140}
						autoFocus
						className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm font-medium text-white placeholder:text-zinc-500 transition"
					/>
				</div>

				{/* Markdown Body */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label htmlFor="post-body" className="text-[11px] font-semibold text-zinc-400">
							Body (Markdown)
						</label>
						<span className="text-[11px] text-zinc-500">
							{wordCount} {wordCount === 1 ? 'word' : 'words'}
						</span>
					</div>
					<textarea
						id="post-body"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="Write using Markdown (# headings, **bold**, > quotes, ```code```)..."
						rows={8}
						className="w-full px-3.5 py-3 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none text-sm font-mono leading-relaxed text-zinc-100 placeholder:text-zinc-500 resize-y transition"
					/>
				</div>

				{/* Echo Policy Selector */}
				<div className="space-y-2">
					<div className="text-[11px] font-semibold text-zinc-400">
						Echo Policy
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
						{ECHO_POLICY_OPTIONS.map((option) => {
							const selected = echoPolicy === option.value
							const Icon = option.icon
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setEchoPolicy(option.value)}
									className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
										selected
											? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/50 text-white'
											: 'bg-white/[0.02] border-white/[0.08] hover:border-white/20 text-zinc-300'
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<span
											className={`w-7 h-7 rounded-lg flex items-center justify-center ${
												selected
													? 'bg-[#8b5cf6]/25 text-[#c4b5fd]'
													: 'bg-white/[0.05] text-zinc-400'
											}`}
										>
											<Icon className="w-4 h-4" />
										</span>
										{selected && (
											<span className="w-4 h-4 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white">
												<CheckIcon className="w-2.5 h-2.5" />
											</span>
										)}
									</div>
									<div className="text-xs font-semibold mt-2.5">{option.label}</div>
									<div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
										{option.description}
									</div>
								</button>
							)
						})}
					</div>
				</div>

				{error && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
						{error}
					</div>
				)}

				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer transition"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting || !title.trim() || !body.trim()}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 cursor-pointer transition"
					>
						{submitting && <SpinnerIcon className="w-3.5 h-3.5" />}
						Publish Post
					</button>
				</div>
			</form>
		</ModalShell>
	)
}

// ---------------------------------------------------------------------------
// 4. SpacePersonaModal
// ---------------------------------------------------------------------------

export interface SpacePersonaModalProps {
	spaceId: string
	spaceName?: string
	initialTag?: string
	initialDisplayName?: string
	initialIsAnonymous?: boolean
	defaultDisplayName?: string
	onClose: () => void
	onSaved?: (identity: {
		tag?: string
		display_name?: string
		is_anonymous: boolean
	}) => void
	onSubmit?: (params: {
		tag?: string
		display_name?: string
		is_anonymous: boolean
	}) => Promise<void> | void
}

export function SpacePersonaModal({
	spaceId,
	spaceName,
	initialTag = '',
	initialDisplayName = '',
	initialIsAnonymous = false,
	defaultDisplayName = 'Concord Member',
	onClose,
	onSaved,
	onSubmit,
}: SpacePersonaModalProps) {
	const [tag, setTag] = useState(sanitizeTag(initialTag))
	const [displayName, setDisplayName] = useState(initialDisplayName)
	const [isAnonymous, setIsAnonymous] = useState(initialIsAnonymous)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const anonSwitchId = useId()

	const previewName = isAnonymous
		? 'Anonymous'
		: displayName.trim() || defaultDisplayName
	const previewTag = isAnonymous ? '@anonymous' : tag ? `@${tag}` : '@member'

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setSubmitting(true)
		setError(null)

		const payload = {
			tag: tag.trim() || undefined,
			display_name: displayName.trim() || undefined,
			is_anonymous: isAnonymous,
		}

		try {
			if (onSubmit) {
				await onSubmit(payload)
			} else {
				await updateSpaceIdentity(spaceId, payload)
			}
			onSaved?.(payload)
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not update Space persona')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<ModalShell
			eyebrow={spaceName ? `${spaceName} / Persona` : 'Contextual Identity'}
			title="Space Persona"
			subtitle="Customize how you appear inside this Space without changing your global profile."
			onClose={onClose}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Live Identity Preview */}
				<div className="rounded-2xl bg-[#15151b] border border-white/[0.08] p-3.5 flex items-center gap-3">
					<div
						className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
							isAnonymous
								? 'bg-zinc-800 border border-white/10 text-zinc-300'
								: 'bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] text-white'
						}`}
					>
						{isAnonymous ? <MaskIcon className="w-4 h-4" /> : previewName.slice(0, 2).toUpperCase()}
					</div>
					<div className="min-w-0">
						<div className="text-sm font-semibold text-white truncate">{previewName}</div>
						<div className="text-xs text-zinc-400 truncate">{previewTag}</div>
					</div>
				</div>

				{/* Contextual @tag */}
				<div className="space-y-1.5">
					<label htmlFor="persona-tag" className="block text-[11px] font-semibold text-zinc-400">
						Contextual @tag
					</label>
					<div className="relative flex items-center">
						<span className="absolute left-3.5 text-sm font-mono text-zinc-500 select-none">@</span>
						<input
							id="persona-tag"
							type="text"
							value={tag}
							disabled={isAnonymous}
							onChange={(e) => setTag(sanitizeTag(e.target.value))}
							placeholder="nightowl"
							maxLength={32}
							className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none disabled:opacity-45 text-sm font-mono text-white placeholder:text-zinc-500 transition"
						/>
					</div>
					<p className="text-[11px] text-zinc-500">
						Scoped only to this Space. Letters, numbers, dots, underscores, or hyphens.
					</p>
				</div>

				{/* Display Name Override */}
				<div className="space-y-1.5">
					<label htmlFor="persona-display-name" className="block text-[11px] font-semibold text-zinc-400">
						Display Name Override
					</label>
					<input
						id="persona-display-name"
						type="text"
						value={displayName}
						disabled={isAnonymous}
						onChange={(e) => setDisplayName(e.target.value)}
						placeholder={defaultDisplayName}
						maxLength={64}
						className="w-full px-3.5 py-2.5 rounded-xl bg-[#15151b] border border-white/10 focus:border-[#8b5cf6]/70 focus:outline-none disabled:opacity-45 text-sm text-white placeholder:text-zinc-500 transition"
					/>
				</div>

				{/* Anonymous Toggle */}
				<div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-3.5 flex items-center justify-between gap-4">
					<div className="min-w-0">
						<label htmlFor={anonSwitchId} className="text-xs font-semibold text-white block cursor-pointer">
							Appear Anonymously
						</label>
						<p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
							Hide your display name and @tag on messages and posts in this Space.
						</p>
					</div>
					<button
						id={anonSwitchId}
						type="button"
						role="switch"
						aria-checked={isAnonymous}
						onClick={() => setIsAnonymous((prev) => !prev)}
						className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition cursor-pointer ${
							isAnonymous
								? 'bg-[#8b5cf6] border-[#a78bfa]/60'
								: 'bg-white/10 border-white/15'
						}`}
					>
						<span
							className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
								isAnonymous ? 'translate-x-5' : 'translate-x-1'
							}`}
						/>
					</button>
				</div>

				{error && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
						{error}
					</div>
				)}

				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer transition"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 cursor-pointer transition"
					>
						{submitting && <SpinnerIcon className="w-3.5 h-3.5" />}
						Save Persona
					</button>
				</div>
			</form>
		</ModalShell>
	)
}
