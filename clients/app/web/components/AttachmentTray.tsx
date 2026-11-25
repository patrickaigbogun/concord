import { useCallback, useEffect, useRef, useState } from 'react'
import { getSession } from '../../lib/auth'
import {
	hasGalleryPermission,
	hasNativeGallery,
	loadNativeGallery,
	readNativeMediaAsFile,
	requestGalleryPermission,
	type NativeGalleryItem,
} from '../../lib/gallery'
import { hapticTap } from '../../lib/haptics'
import { uploadFile } from '../../lib/storage'
import { isUuid } from '../../lib/url'
import type { FileAsset } from '../../lib/types'

export interface DeviceGalleryItem {
	id: string
	file: File
	previewUrl: string
	kind: 'image' | 'video'
}

interface AttachmentTrayProps {
	spaceId: string
	galleryItems: DeviceGalleryItem[]
	onAddGalleryItems: (items: DeviceGalleryItem[]) => void
	onClose: () => void
	onSendAsset: (asset: FileAsset, caption?: string) => void
}

type CropMode = 'original' | 'square'
type NativePermState = 'checking' | 'granted' | 'denied'

interface PendingImage {
	file: File
	previewUrl: string
	rotation: number
	cropMode: CropMode
}

interface PendingVideo {
	file: File
	previewUrl: string
	duration: number
	muted: boolean
}

interface PendingDoc {
	file: File
	isPdf: boolean
	textPreview?: string
}

const MAX_INLINE_VIDEO_BYTES = 25 * 1024 * 1024
const MAX_INLINE_VIDEO_SECONDS = 60
const NATIVE_PAGE_SIZE = 48

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function optimizeImageToWebP(file: File, rotationDeg: number, cropMode: CropMode): Promise<File> {
	const bitmap = await createImageBitmap(file)
	const maxDim = 1600
	let sx = 0
	let sy = 0
	let sw = bitmap.width
	let sh = bitmap.height

	if (cropMode === 'square') {
		const side = Math.min(bitmap.width, bitmap.height)
		sx = Math.floor((bitmap.width - side) / 2)
		sy = Math.floor((bitmap.height - side) / 2)
		sw = side
		sh = side
	}

	const scale = Math.min(1, maxDim / Math.max(sw, sh))
	const drawW = Math.max(1, Math.round(sw * scale))
	const drawH = Math.max(1, Math.round(sh * scale))
	const normalizedRot = ((rotationDeg % 360) + 360) % 360
	const swap = normalizedRot === 90 || normalizedRot === 270

	const canvas = document.createElement('canvas')
	canvas.width = swap ? drawH : drawW
	canvas.height = swap ? drawW : drawH

	const ctx = canvas.getContext('2d')
	if (!ctx) {
		bitmap.close()
		return file
	}

	ctx.translate(canvas.width / 2, canvas.height / 2)
	ctx.rotate((normalizedRot * Math.PI) / 180)
	ctx.drawImage(bitmap, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH)
	bitmap.close()

	const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84))
	if (!blob) return file
	const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
	return new File([blob], `${base}.webp`, { type: 'image/webp' })
}

function probeVideoDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const video = document.createElement('video')
		video.preload = 'metadata'
		video.muted = true
		const done = (val: number) => {
			video.onloadedmetadata = null
			video.onerror = null
			video.src = ''
			resolve(val)
		}
		video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : 0)
		video.onerror = () => done(0)
		video.src = url
	})
}

export function AttachmentTray({
	spaceId,
	galleryItems,
	onAddGalleryItems,
	onClose,
	onSendAsset,
}: AttachmentTrayProps) {
	// Expandable drawer state: swipe up to expand (46dvh -> 82dvh), swipe down to collapse/close
	const [expanded, setExpanded] = useState(false)
	const dragStartYRef = useRef<number | null>(null)
	const bodyDragStartYRef = useRef<number | null>(null)
	const bodyStartedAtTopRef = useRef(false)
	const scrollBodyRef = useRef<HTMLDivElement>(null)

	// Native Android gallery state
	const isNative = hasNativeGallery()
	const [nativePerm, setNativePerm] = useState<NativePermState>(() =>
		isNative ? (hasGalleryPermission() ? 'granted' : 'checking') : 'denied'
	)
	const [nativeItems, setNativeItems] = useState<NativeGalleryItem[]>([])
	const [loadingNative, setLoadingNative] = useState(false)
	const [hasMoreNative, setHasMoreNative] = useState(false)
	const [openingNativeId, setOpeningNativeId] = useState<string | null>(null)

	const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
	const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null)
	const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null)

	const [caption, setCaption] = useState('')
	const [uploading, setUploading] = useState(false)
	const [statusMsg, setStatusMsg] = useState<string | null>(null)

	const galleryInputRef = useRef<HTMLInputElement>(null)
	const cameraInputRef = useRef<HTMLInputElement>(null)
	const docInputRef = useRef<HTMLInputElement>(null)

	const isMountedRef = useRef(true)
	const ownedPreviewUrlsRef = useRef<Set<string>>(new Set())

	const trackOwnedUrl = (url: string) => {
		if (url.startsWith('blob:')) ownedPreviewUrlsRef.current.add(url)
		return url
	}

	const releaseOwnedUrl = (url?: string | null) => {
		if (!url || !url.startsWith('blob:')) return
		if (!ownedPreviewUrlsRef.current.has(url)) return
		ownedPreviewUrlsRef.current.delete(url)
		URL.revokeObjectURL(url)
	}

	const clearPending = () => {
		if (pendingImage) releaseOwnedUrl(pendingImage.previewUrl)
		if (pendingVideo) releaseOwnedUrl(pendingVideo.previewUrl)
		setPendingImage(null)
		setPendingVideo(null)
		setPendingDoc(null)
		setCaption('')
		setStatusMsg(null)
	}

	const fetchNativePage = useCallback(async (offset: number, append: boolean) => {
		setLoadingNative(true)
		try {
			const page = await loadNativeGallery(NATIVE_PAGE_SIZE, offset)
			if (!isMountedRef.current) return
			setNativeItems((prev) => (append ? [...prev, ...page] : page))
			setHasMoreNative(page.length >= NATIVE_PAGE_SIZE)
		} finally {
			if (isMountedRef.current) setLoadingNative(false)
		}
	}, [])

	const triggerNativePermission = useCallback(async () => {
		if (!isNative) return
		setNativePerm('checking')
		setStatusMsg(null)
		const granted = await requestGalleryPermission()
		if (!isMountedRef.current) return
		if (granted) {
			setNativePerm('granted')
			await fetchNativePage(0, false)
		} else {
			setNativePerm('denied')
		}
	}, [isNative, fetchNativePage])

	useEffect(() => {
		isMountedRef.current = true
		if (isNative) {
			if (hasGalleryPermission()) {
				setNativePerm('granted')
				void fetchNativePage(0, false)
			} else {
				void triggerNativePermission()
			}
		}
		return () => {
			isMountedRef.current = false
			for (const url of ownedPreviewUrlsRef.current) {
				URL.revokeObjectURL(url)
			}
			ownedPreviewUrlsRef.current.clear()
		}
	}, [isNative, fetchNativePage, triggerNativePermission])

	const uploadAssetOrFallback = async (
		file: File,
		kind: FileAsset['kind'],
		fallbackUrl: string,
		previewText?: string
	): Promise<FileAsset> => {
		const isLiveSignedIn = Boolean(getSession()?.access_token && isUuid(spaceId))
		try {
			const uploaded = await uploadFile(file, isUuid(spaceId) ? spaceId : undefined)
			releaseOwnedUrl(fallbackUrl)
			return {
				id: uploaded.id,
				spaceId,
				filename: uploaded.filename,
				contentType: uploaded.content_type,
				sizeBytes: uploaded.size_bytes,
				url: uploaded.url,
				kind,
				previewText,
				createdAt: 'Just now',
			}
		} catch (err) {
			if (isLiveSignedIn) {
				if (fallbackUrl !== pendingImage?.previewUrl && fallbackUrl !== pendingVideo?.previewUrl) {
					releaseOwnedUrl(fallbackUrl)
				}
				throw err instanceof Error ? err : new Error('Upload to Concord R2 failed')
			}
			ownedPreviewUrlsRef.current.delete(fallbackUrl)
			return {
				id: `local-${Date.now()}`,
				spaceId,
				filename: file.name,
				contentType: file.type || 'application/octet-stream',
				sizeBytes: file.size,
				url: fallbackUrl,
				kind,
				previewText,
				createdAt: 'Just now',
			}
		}
	}

	const openGalleryFileInEditor = async (item: DeviceGalleryItem) => {
		clearPending()
		hapticTap()

		if (item.kind === 'video') {
			const withinSize = item.file.size <= MAX_INLINE_VIDEO_BYTES
			const duration = withinSize ? await probeVideoDuration(item.previewUrl) : Infinity
			if (!isMountedRef.current) return
			if (withinSize && duration <= MAX_INLINE_VIDEO_SECONDS) {
				setPendingVideo({ file: item.file, previewUrl: item.previewUrl, duration, muted: false })
				return
			}
			setUploading(true)
			try {
				const asset = await uploadAssetOrFallback(item.file, 'video', item.previewUrl)
				onSendAsset(asset)
				onClose()
			} catch (err) {
				setStatusMsg(err instanceof Error ? err.message : 'Video upload failed')
			} finally {
				setUploading(false)
			}
			return
		}

		setPendingImage({ file: item.file, previewUrl: item.previewUrl, rotation: 0, cropMode: 'original' })
	}

	const handleSelectNativeItem = async (item: NativeGalleryItem) => {
		if (openingNativeId) return
		setOpeningNativeId(item.id)
		setStatusMsg(null)
		hapticTap()
		try {
			const file = await readNativeMediaAsFile(item)
			if (!isMountedRef.current) return
			const previewUrl = trackOwnedUrl(URL.createObjectURL(file))
			await openGalleryFileInEditor({
				id: item.id,
				file,
				previewUrl,
				kind: item.kind,
			})
		} catch (err) {
			if (isMountedRef.current) {
				setStatusMsg(err instanceof Error ? err.message : 'Failed to open media')
			}
		} finally {
			if (isMountedRef.current) setOpeningNativeId(null)
		}
	}

	const handlePickDeviceMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || [])
		e.target.value = ''
		if (files.length === 0) return

		const newItems: DeviceGalleryItem[] = files.map((file, idx) => ({
			id: `dev-${Date.now()}-${idx}`,
			file,
			previewUrl: URL.createObjectURL(file),
			kind: file.type.startsWith('video/') ? 'video' : 'image',
		}))

		onAddGalleryItems(newItems)

		if (newItems.length === 1) {
			await openGalleryFileInEditor(newItems[0])
		} else {
			setExpanded(true)
		}
	}

	const handlePickDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPending()

		const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
		let textPreview: string | undefined
		if (
			!isPdf &&
			(file.type.startsWith('text/') ||
				file.type === 'application/json' ||
				/\.(md|txt|json|csv|ts|tsx|js|jsx|py|go|rs|ex|exs|css|html|yaml|yml)$/i.test(file.name))
		) {
			textPreview = (await file.text()).slice(0, 4000)
		}
		setPendingDoc({ file, isPdf, textPreview })
	}

	const handleSendPending = async () => {
		if (!pendingImage && !pendingVideo && !pendingDoc) return
		setUploading(true)
		setStatusMsg(null)
		try {
			let asset: FileAsset
			if (pendingImage) {
				const optimized = await optimizeImageToWebP(
					pendingImage.file,
					pendingImage.rotation,
					pendingImage.cropMode
				)
				const fallbackUrl = trackOwnedUrl(URL.createObjectURL(optimized))
				asset = await uploadAssetOrFallback(optimized, 'image', fallbackUrl)
			} else if (pendingVideo) {
				asset = await uploadAssetOrFallback(pendingVideo.file, 'video', pendingVideo.previewUrl)
			} else if (pendingDoc) {
				const fallbackUrl = pendingDoc.isPdf ? trackOwnedUrl(URL.createObjectURL(pendingDoc.file)) : '#'
				asset = await uploadAssetOrFallback(pendingDoc.file, 'doc', fallbackUrl, pendingDoc.textPreview)
			} else {
				return
			}
			onSendAsset(asset, caption.trim() || undefined)
			onClose()
		} catch (err) {
			setStatusMsg(err instanceof Error ? err.message : 'Upload failed')
		} finally {
			setUploading(false)
		}
	}

	// Swipe up/down on drawer header/handle to expand, collapse, or dismiss
	const onHandleTouchStart = (e: React.TouchEvent) => {
		dragStartYRef.current = e.touches[0].clientY
	}

	const onHandleTouchEnd = (e: React.TouchEvent) => {
		if (dragStartYRef.current === null) return
		const dy = e.changedTouches[0].clientY - dragStartYRef.current
		dragStartYRef.current = null
		if (dy < -30) {
			hapticTap()
			setExpanded(true)
		} else if (dy > 36) {
			hapticTap()
			if (expanded) setExpanded(false)
			else onClose()
		}
	}

	// Swipe up/down on scrollable gallery body when at top (scrollTop === 0)
	const onBodyTouchStart = (e: React.TouchEvent) => {
		bodyDragStartYRef.current = e.touches[0].clientY
		bodyStartedAtTopRef.current = (scrollBodyRef.current?.scrollTop ?? 0) <= 2
	}

	const onBodyTouchEnd = (e: React.TouchEvent) => {
		if (bodyDragStartYRef.current === null) return
		const dy = e.changedTouches[0].clientY - bodyDragStartYRef.current
		const startedAtTop = bodyStartedAtTopRef.current
		bodyDragStartYRef.current = null
		bodyStartedAtTopRef.current = false

		if (!expanded && dy < -36) {
			hapticTap()
			setExpanded(true)
		} else if (startedAtTop && dy > 44) {
			hapticTap()
			if (expanded) setExpanded(false)
			else onClose()
		}
	}

	return (
		<div
			data-no-pane-swipe="true"
			className={`bg-[#221d19] rounded-t-3xl flex flex-col select-none transition-[height] duration-300 ease-out shrink-0 ${
				expanded ? 'h-[82dvh]' : 'h-[46dvh] min-h-[300px]'
			}`}
		>
			{/* Hidden OS Pickers */}
			<input
				ref={galleryInputRef}
				type="file"
				accept="image/*,video/*"
				multiple
				onChange={handlePickDeviceMedia}
				className="hidden"
			/>
			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				onChange={handlePickDeviceMedia}
				className="hidden"
			/>
			<input
				ref={docInputRef}
				type="file"
				accept=".pdf,.md,.txt,.json,.csv,.ts,.tsx,.js,.py,.go,.rs,.ex,.doc,.docx"
				onChange={handlePickDoc}
				className="hidden"
			/>

			{/* Swipeable Drawer Header & Handle */}
			<div
				onTouchStart={onHandleTouchStart}
				onTouchEnd={onHandleTouchEnd}
				onClick={() => {
					hapticTap()
					setExpanded((v) => !v)
				}}
				className="pt-2.5 pb-2.5 px-4 flex flex-col items-center gap-1.5 cursor-pointer shrink-0"
				title={expanded ? 'Collapse drawer' : 'Expand drawer'}
			>
				<span className="w-11 h-1.5 rounded-full bg-[#e5ebcd]/20" />
			</div>

			{/* Scrollable Drawer Body */}
			<div
				ref={scrollBodyRef}
				onTouchStart={onBodyTouchStart}
				onTouchEnd={onBodyTouchEnd}
				className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3.5 pb-2"
			>
				{pendingImage || pendingVideo || pendingDoc ? (
					<div className="space-y-3 pb-2">
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={clearPending}
								className="text-[14px] font-semibold text-[#b8afa3] hover:text-[#e5ebcd] cursor-pointer"
							>
								Back
							</button>
							<div className="flex items-center gap-2">
								{pendingImage && (
									<>
										<button
											type="button"
											onClick={() =>
												setPendingImage((p) => (p ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
											}
											className="px-3 py-1.5 rounded-xl bg-[#2a241f] hover:bg-[#352e27] text-[13px] font-semibold text-[#e5ebcd] cursor-pointer transition"
										>
											Rotate
										</button>
										<button
											type="button"
											onClick={() =>
												setPendingImage((p) =>
													p ? { ...p, cropMode: p.cropMode === 'square' ? 'original' : 'square' } : p
												)
											}
											className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold cursor-pointer transition ${
												pendingImage.cropMode === 'square'
													? 'bg-[#cedb9c] text-[#1b1714]'
													: 'bg-[#2a241f] text-[#e5ebcd] hover:bg-[#352e27]'
											}`}
										>
											1:1
										</button>
									</>
								)}
							</div>
						</div>

						{pendingImage && (
							<div className="rounded-2xl overflow-hidden bg-[#1b1714] flex items-center justify-center max-h-56">
								<img
									src={pendingImage.previewUrl}
									alt="Preview"
									style={{ transform: `rotate(${pendingImage.rotation}deg)` }}
									className={`max-h-56 transition-transform ${
										pendingImage.cropMode === 'square' ? 'w-52 h-52 object-cover' : 'object-contain'
									}`}
								/>
							</div>
						)}

						{pendingVideo && (
							<div className="rounded-2xl overflow-hidden bg-[#1b1714]">
								<video
									src={pendingVideo.previewUrl}
									controls
									muted={pendingVideo.muted}
									playsInline
									className="w-full max-h-52 object-contain"
								/>
							</div>
						)}

						{pendingDoc && (
							<div className="rounded-2xl bg-[#1b1714] p-4 flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="text-[15px] font-semibold text-[#e5ebcd] truncate">{pendingDoc.file.name}</div>
									<div className="text-[13px] text-[#9a8f82]">{formatBytes(pendingDoc.file.size)}</div>
								</div>
								<span className="px-2.5 py-1 rounded-lg bg-[#2a241f] text-[#cedb9c] text-[12px] font-semibold shrink-0">
									{pendingDoc.isPdf ? 'PDF' : 'File'}
								</span>
							</div>
						)}

						<div className="flex items-center gap-2">
							<input
								type="text"
								value={caption}
								onChange={(e) => setCaption(e.target.value)}
								placeholder="Add a caption…"
								className="flex-1 min-w-0 rounded-2xl bg-[#1b1714] px-4 py-3 text-[15px] text-[#e5ebcd] placeholder:text-[#8c8276] focus:outline-none"
							/>
							<button
								type="button"
								disabled={uploading}
								onClick={handleSendPending}
								className="px-5 py-3 rounded-2xl bg-[#cedb9c] text-[#1b1714] hover:bg-[#dce6b5] disabled:opacity-40 text-[14px] font-bold cursor-pointer shrink-0 transition"
							>
								{uploading ? 'Sending…' : 'Send'}
							</button>
						</div>
					</div>
				) : isNative ? (
					/* Native Android MediaStore Gallery */
					<div className="h-full flex flex-col">
						{nativePerm === 'denied' ? (
							<div className="flex-1 min-h-[160px] w-full rounded-2xl bg-[#1b1714] flex flex-col items-center justify-center gap-3 p-6 text-center">
								<span className="w-12 h-12 rounded-2xl bg-[#2a241f] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-1 max-w-xs">
									<div className="text-[15px] font-semibold text-[#e5ebcd]">Photo & Video Access</div>
									<div className="text-[13px] text-[#9a8f82]">
										Allow Concord to show your recent photos and videos right here.
									</div>
								</div>
								<button
									type="button"
									onClick={() => void triggerNativePermission()}
									className="mt-1 px-4 py-2.5 rounded-xl bg-[#cedb9c] text-[#1b1714] hover:bg-[#dce6b5] text-[14px] font-semibold cursor-pointer transition"
								>
									Allow Photo & Video Access
								</button>
							</div>
						) : nativePerm === 'checking' || (loadingNative && nativeItems.length === 0) ? (
							<div className="grid grid-cols-3 gap-1.5 pb-2">
								{Array.from({ length: 9 }).map((_, idx) => (
									<div
										key={idx}
										className="aspect-square rounded-xl bg-[#2a241f] animate-pulse"
									/>
								))}
							</div>
						) : nativeItems.length > 0 ? (
							<div className="space-y-2 pb-2">
								<div className="grid grid-cols-3 gap-1.5">
									{nativeItems.map((item) => {
										const isOpening = openingNativeId === item.id
										return (
											<button
												key={item.id}
												type="button"
												disabled={Boolean(openingNativeId)}
												onClick={() => void handleSelectNativeItem(item)}
												className="aspect-square rounded-xl overflow-hidden bg-[#1b1714] relative group cursor-pointer disabled:opacity-60"
											>
												{item.thumbnailDataUrl ? (
													<img
														src={item.thumbnailDataUrl}
														alt={item.filename}
														loading="lazy"
														className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-[#9a8f82]">
														<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
															<rect x="3" y="3" width="18" height="18" rx="3" />
															<circle cx="8.5" cy="8.5" r="1.5" />
															<path d="M21 15l-5-5L5 21" />
														</svg>
													</div>
												)}
												{item.kind === 'video' && (
													<span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-[#1b1714]/80 text-[#e5ebcd] flex items-center justify-center">
														<svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
															<path d="M6 4l15 8-15 8V4z" />
														</svg>
													</span>
												)}
												{isOpening && (
													<div className="absolute inset-0 bg-[#1b1714]/70 flex items-center justify-center">
														<span className="w-5 h-5 border-2 border-[#cedb9c] border-t-transparent rounded-full animate-spin" />
													</div>
												)}
											</button>
										)
									})}
								</div>
								{hasMoreNative && (
									<button
										type="button"
										disabled={loadingNative}
										onClick={() => void fetchNativePage(nativeItems.length, true)}
										className="w-full py-2.5 rounded-xl bg-[#2a241f] hover:bg-[#352e27] text-[13px] font-semibold text-[#e5ebcd] disabled:opacity-50 cursor-pointer transition"
									>
										{loadingNative ? 'Loading…' : 'Load more'}
									</button>
								)}
							</div>
						) : (
							<button
								type="button"
								onClick={() => galleryInputRef.current?.click()}
								className="flex-1 min-h-[150px] w-full rounded-2xl bg-[#1b1714] hover:bg-[#2a241f] flex flex-col items-center justify-center gap-2.5 p-6 text-center transition cursor-pointer"
							>
								<span className="w-12 h-12 rounded-2xl bg-[#2a241f] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-0.5">
									<div className="text-[15px] font-semibold text-[#e5ebcd]">No recent media found</div>
									<div className="text-[13px] text-[#9a8f82]">Tap to browse device files</div>
								</div>
							</button>
						)}
					</div>
				) : (
					/* Web Multi-Select Gallery Fallback */
					<div className="h-full flex flex-col">
						{galleryItems.length > 0 ? (
							<div className="grid grid-cols-3 gap-1.5 pb-2">
								{galleryItems.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => void openGalleryFileInEditor(item)}
										className="aspect-square rounded-xl overflow-hidden bg-[#1b1714] relative group cursor-pointer"
									>
										{item.kind === 'video' ? (
											<>
												<video src={item.previewUrl} muted playsInline className="w-full h-full object-cover" />
												<span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-[#1b1714]/80 text-[#e5ebcd] flex items-center justify-center">
													<svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
														<path d="M6 4l15 8-15 8V4z" />
													</svg>
												</span>
											</>
										) : (
											<img
												src={item.previewUrl}
												alt={item.file.name}
												className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
											/>
										)}
									</button>
								))}
								<button
									type="button"
									onClick={() => galleryInputRef.current?.click()}
									className="aspect-square rounded-xl bg-[#2a241f] hover:bg-[#352e27] flex flex-col items-center justify-center gap-1.5 text-[#e5ebcd] cursor-pointer transition"
								>
									<svg className="w-6 h-6 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									<span className="text-[12px] font-semibold">More</span>
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => galleryInputRef.current?.click()}
								className="flex-1 min-h-[150px] w-full rounded-2xl bg-[#1b1714] hover:bg-[#2a241f] flex flex-col items-center justify-center gap-2.5 p-6 text-center transition cursor-pointer"
							>
								<span className="w-12 h-12 rounded-2xl bg-[#2a241f] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-0.5">
									<div className="text-[15px] font-semibold text-[#e5ebcd]">Open Device Gallery</div>
									<div className="text-[13px] text-[#9a8f82]">
										Pick photos or videos — swipe up to expand
									</div>
								</div>
							</button>
						)}
					</div>
				)}

				{statusMsg && (
					<div className="mt-2 rounded-xl bg-red-500/15 px-3.5 py-2 text-[13px] text-red-300">
						{statusMsg}
					</div>
				)}
			</div>

			{/* Bottom Action Row (Gallery | File | Camera) */}
			{!pendingImage && !pendingVideo && !pendingDoc && (
				<div className="px-4 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-[#1b1714] grid grid-cols-3 gap-3 shrink-0">
					<button
						type="button"
						onClick={() => galleryInputRef.current?.click()}
						className="flex flex-col items-center gap-1.5 cursor-pointer group"
					>
						<span className="w-12 h-12 rounded-2xl bg-[#2a241f] group-hover:bg-[#352e27] text-[#e5ebcd] flex items-center justify-center transition">
							<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="18" height="18" rx="3" />
								<circle cx="8.5" cy="8.5" r="1.5" />
								<path d="M21 15l-5-5L5 21" />
							</svg>
						</span>
						<span className="text-[12px] font-medium text-[#b8afa3]">Gallery</span>
					</button>

					<button
						type="button"
						onClick={() => docInputRef.current?.click()}
						className="flex flex-col items-center gap-1.5 cursor-pointer group"
					>
						<span className="w-12 h-12 rounded-2xl bg-[#2a241f] group-hover:bg-[#352e27] text-[#e5ebcd] flex items-center justify-center transition">
							<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
						</span>
						<span className="text-[12px] font-medium text-[#b8afa3]">File</span>
					</button>

					<button
						type="button"
						onClick={() => cameraInputRef.current?.click()}
						className="flex flex-col items-center gap-1.5 cursor-pointer group"
					>
						<span className="w-12 h-12 rounded-2xl bg-[#2a241f] group-hover:bg-[#352e27] text-[#e5ebcd] flex items-center justify-center transition">
							<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
								<circle cx="12" cy="13" r="4" />
							</svg>
						</span>
						<span className="text-[12px] font-medium text-[#b8afa3]">Camera</span>
					</button>
				</div>
			)}
		</div>
	)
}
