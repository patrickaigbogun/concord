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
import type { FileAsset } from '../../lib/types'
import { isUuid } from '../../lib/url'

export interface DeviceGalleryItem {
	id: string
	file: File
	previewUrl: string
	kind: 'image' | 'video'
}

export type CropMode = 'original' | 'square'

export interface StagedAttachment {
	id: string
	file: File
	previewUrl: string
	kind: 'image' | 'video' | 'doc'
	rotation: number
	cropMode: CropMode
	isPdf?: boolean
	textPreview?: string
}

interface AttachmentTrayProps {
	spaceId: string
	galleryItems: DeviceGalleryItem[]
	stagedAttachments: StagedAttachment[]
	onChangeStaged: (next: StagedAttachment[]) => void
	onAddGalleryItems: (items: DeviceGalleryItem[]) => void
	onClose: () => void
}

type NativePermState = 'checking' | 'granted' | 'denied'

const NATIVE_PAGE_SIZE = 48

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function optimizeImageToWebP(file: File, rotationDeg: number, cropMode: CropMode): Promise<File> {
	// Skip re-encoding if no edits were applied and file is already web-friendly
	if (rotationDeg === 0 && cropMode === 'original' && file.size < 2.5 * 1024 * 1024) {
		return file
	}
	try {
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
	} catch {
		return file
	}
}

export async function uploadStagedAttachment(
	item: StagedAttachment,
	spaceId: string
): Promise<FileAsset> {
	const fileToUpload =
		item.kind === 'image'
			? await optimizeImageToWebP(item.file, item.rotation, item.cropMode)
			: item.file

	const isLiveSignedIn = Boolean(getSession()?.access_token && isUuid(spaceId))
	try {
		const uploaded = await uploadFile(fileToUpload, isUuid(spaceId) ? spaceId : undefined)
		return {
			id: uploaded.id,
			spaceId,
			filename: uploaded.filename,
			contentType: uploaded.content_type,
			sizeBytes: uploaded.size_bytes,
			url: uploaded.url,
			kind: item.kind,
			previewText: item.textPreview,
			createdAt: 'Just now',
		}
	} catch (err) {
		if (isLiveSignedIn) {
			throw err instanceof Error ? err : new Error('Upload failed')
		}
		return {
			id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			spaceId,
			filename: fileToUpload.name,
			contentType: fileToUpload.type || 'application/octet-stream',
			sizeBytes: fileToUpload.size,
			url: item.previewUrl || URL.createObjectURL(fileToUpload),
			kind: item.kind,
			previewText: item.textPreview,
			createdAt: 'Just now',
		}
	}
}

export function AttachmentTray({
	galleryItems,
	stagedAttachments,
	onChangeStaged,
	onAddGalleryItems,
	onClose,
}: AttachmentTrayProps) {
	const [expanded, setExpanded] = useState(false)
	const [activeEditId, setActiveEditId] = useState<string | null>(null)
	const dragStartYRef = useRef<number | null>(null)
	const bodyDragStartYRef = useRef<number | null>(null)
	const bodyStartedAtTopRef = useRef(false)
	const scrollBodyRef = useRef<HTMLDivElement>(null)

	const isNative = hasNativeGallery()
	const [nativePerm, setNativePerm] = useState<NativePermState>(() =>
		isNative ? (hasGalleryPermission() ? 'granted' : 'checking') : 'denied'
	)
	const [nativeItems, setNativeItems] = useState<NativeGalleryItem[]>([])
	const [loadingNative, setLoadingNative] = useState(false)
	const [hasMoreNative, setHasMoreNative] = useState(false)
	const [openingNativeId, setOpeningNativeId] = useState<string | null>(null)
	const [statusMsg, setStatusMsg] = useState<string | null>(null)

	const galleryInputRef = useRef<HTMLInputElement>(null)
	const cameraInputRef = useRef<HTMLInputElement>(null)
	const docInputRef = useRef<HTMLInputElement>(null)
	const isMountedRef = useRef(true)

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	// Keep activeEditId synced to a valid staged item
	const activeStaged =
		stagedAttachments.find((s) => s.id === activeEditId) || stagedAttachments[stagedAttachments.length - 1] || null

	const fetchNativePage = useCallback(async (offset: number, append: boolean) => {
		setLoadingNative(true)
		setStatusMsg(null)
		try {
			const items = await loadNativeGallery(NATIVE_PAGE_SIZE, offset)
			if (!isMountedRef.current) return
			setNativePerm('granted')
			setNativeItems((prev) => (append ? [...prev, ...items] : items))
			setHasMoreNative(items.length >= NATIVE_PAGE_SIZE)
		} catch (err) {
			if (isMountedRef.current) {
				setStatusMsg(err instanceof Error ? err.message : 'Could not load device gallery')
			}
		} finally {
			if (isMountedRef.current) setLoadingNative(false)
		}
	}, [])

	const triggerNativePermission = useCallback(async () => {
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
	}, [fetchNativePage])

	useEffect(() => {
		if (!isNative) return
		if (hasGalleryPermission()) {
			void fetchNativePage(0, false)
		} else {
			void triggerNativePermission()
		}
	}, [isNative, fetchNativePage, triggerNativePermission])

	const toggleGalleryItem = (item: DeviceGalleryItem) => {
		hapticTap()
		setStatusMsg(null)
		const exists = stagedAttachments.some((s) => s.id === item.id)
		if (exists) {
			const next = stagedAttachments.filter((s) => s.id !== item.id)
			onChangeStaged(next)
			if (activeEditId === item.id) {
				setActiveEditId(next[next.length - 1]?.id ?? null)
			}
		} else {
			const staged: StagedAttachment = {
				id: item.id,
				file: item.file,
				previewUrl: item.previewUrl,
				kind: item.kind,
				rotation: 0,
				cropMode: 'original',
			}
			onChangeStaged([...stagedAttachments, staged])
			setActiveEditId(staged.id)
		}
	}

	const toggleNativeItem = async (item: NativeGalleryItem) => {
		const exists = stagedAttachments.some((s) => s.id === item.id)
		if (exists) {
			hapticTap()
			const next = stagedAttachments.filter((s) => s.id !== item.id)
			onChangeStaged(next)
			if (activeEditId === item.id) {
				setActiveEditId(next[next.length - 1]?.id ?? null)
			}
			return
		}
		if (openingNativeId) return
		setOpeningNativeId(item.id)
		setStatusMsg(null)
		hapticTap()
		try {
			const file = await readNativeMediaAsFile(item)
			if (!isMountedRef.current) return
			const previewUrl = URL.createObjectURL(file)
			const staged: StagedAttachment = {
				id: item.id,
				file,
				previewUrl,
				kind: item.kind,
				rotation: 0,
				cropMode: 'original',
			}
			onChangeStaged([...stagedAttachments, staged])
			setActiveEditId(staged.id)
		} catch (err) {
			if (isMountedRef.current) {
				setStatusMsg(err instanceof Error ? err.message : 'Failed to open media')
			}
		} finally {
			if (isMountedRef.current) setOpeningNativeId(null)
		}
	}

	const handlePickDeviceMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
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
		const newStaged: StagedAttachment[] = newItems.map((it) => ({
			id: it.id,
			file: it.file,
			previewUrl: it.previewUrl,
			kind: it.kind,
			rotation: 0,
			cropMode: 'original',
		}))
		onChangeStaged([...stagedAttachments, ...newStaged])
		setActiveEditId(newStaged[newStaged.length - 1]?.id ?? null)
		setExpanded(true)
	}

	const handlePickDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return

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
		const staged: StagedAttachment = {
			id: `doc-${Date.now()}`,
			file,
			previewUrl: URL.createObjectURL(file),
			kind: 'doc',
			rotation: 0,
			cropMode: 'original',
			isPdf,
			textPreview,
		}
		onChangeStaged([staged])
		setActiveEditId(staged.id)
	}

	const updateActiveImage = (updater: (item: StagedAttachment) => StagedAttachment) => {
		if (!activeStaged) return
		onChangeStaged(stagedAttachments.map((s) => (s.id === activeStaged.id ? updater(s) : s)))
	}

	const onHandleTouchStart = (e: React.TouchEvent) => {
		dragStartYRef.current = e.touches[0].clientY
	}

	const onHandleTouchEnd = (e: React.TouchEvent) => {
		if (dragStartYRef.current === null) return
		const dy = e.changedTouches[0].clientY - dragStartYRef.current
		dragStartYRef.current = null
		if (dy < -28) {
			hapticTap()
			setExpanded(true)
		} else if (dy > 32) {
			hapticTap()
			if (expanded) setExpanded(false)
			else onClose()
		}
	}

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

	const getSelectionIndex = (id: string) => stagedAttachments.findIndex((s) => s.id === id)

	return (
		<div
			data-no-pane-swipe="true"
			className={`bg-[#08100d] rounded-t-3xl flex flex-col select-none transition-[height] duration-300 ease-out shrink-0 ${
				expanded ? 'h-[78dvh]' : 'h-[44dvh] min-h-[290px]'
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

			{/* Swipeable Drawer Handle */}
			<div
				onTouchStart={onHandleTouchStart}
				onTouchEnd={onHandleTouchEnd}
				onClick={() => {
					hapticTap()
					setExpanded((v) => !v)
				}}
				className="pt-2.5 pb-2 px-4 flex flex-col items-center cursor-pointer shrink-0"
			>
				<span className="w-11 h-1.5 rounded-full bg-[#e5ebcd]/20" />
			</div>

			{/* Lightweight Inline Editor Strip (Images get Rotate/1:1; Videos get preview only; NO duplicate send button) */}
			{activeStaged && (
				<div className="px-3.5 pb-2.5 space-y-2 shrink-0">
					<div className="flex items-center justify-between gap-2">
						<button
							type="button"
							onClick={() => {
								hapticTap()
								onChangeStaged([])
								setActiveEditId(null)
							}}
							className="text-[13px] font-semibold text-[#9e998c] hover:text-[#edf3d2] cursor-pointer"
						>
							Clear ({stagedAttachments.length})
						</button>

						{activeStaged.kind === 'image' && (
							<div className="flex items-center gap-1.5">
								<button
									type="button"
									onClick={() => {
										hapticTap()
										updateActiveImage((it) => ({ ...it, rotation: (it.rotation + 90) % 360 }))
									}}
									className="px-2.5 py-1 rounded-xl bg-[#0f1f19] hover:bg-[#152a22] text-[12px] font-semibold text-[#edf3d2] cursor-pointer transition"
								>
									Rotate
								</button>
								<button
									type="button"
									onClick={() => {
										hapticTap()
										updateActiveImage((it) => ({
											...it,
											cropMode: it.cropMode === 'square' ? 'original' : 'square',
										}))
									}}
									className={`px-2.5 py-1 rounded-xl text-[12px] font-semibold cursor-pointer transition ${
										activeStaged.cropMode === 'square'
											? 'bg-[#cedb9c] text-[#050a08]'
											: 'bg-[#0f1f19] text-[#edf3d2] hover:bg-[#152a22]'
									}`}
								>
									1:1
								</button>
							</div>
						)}
					</div>

					{activeStaged.kind === 'image' && (
						<div className="rounded-2xl overflow-hidden bg-[#050a08] flex items-center justify-center max-h-40">
							<img
								src={activeStaged.previewUrl}
								alt={activeStaged.file.name}
								style={{ transform: `rotate(${activeStaged.rotation}deg)` }}
								className={`max-h-40 transition-transform ${
									activeStaged.cropMode === 'square' ? 'w-36 h-36 object-cover' : 'object-contain'
								}`}
							/>
						</div>
					)}

					{activeStaged.kind === 'video' && (
						<div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-36">
							<video
								src={activeStaged.previewUrl}
								muted
								playsInline
								className="max-h-36 w-full object-contain"
							/>
						</div>
					)}

					{activeStaged.kind === 'doc' && (
						<div className="rounded-2xl bg-[#221d19] px-3.5 py-2.5 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<div className="text-[14px] font-semibold text-[#edf3d2] truncate">
									{activeStaged.file.name}
								</div>
								<div className="text-[12px] text-[#9e998c]">{formatBytes(activeStaged.file.size)}</div>
							</div>
							<span className="text-[12px] font-semibold text-[#cedb9c] shrink-0">
								{activeStaged.isPdf ? 'PDF' : 'File'}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Scrollable Multi-Select Gallery Body */}
			<div
				ref={scrollBodyRef}
				onTouchStart={onBodyTouchStart}
				onTouchEnd={onBodyTouchEnd}
				className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3.5 pb-2"
			>
				{isNative ? (
					<div className="h-full flex flex-col">
						{nativePerm === 'denied' ? (
							<div className="flex-1 min-h-[140px] w-full rounded-2xl bg-[#050a08] flex flex-col items-center justify-center gap-3 p-6 text-center">
								<span className="w-12 h-12 rounded-2xl bg-[#0f1f19] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-1 max-w-xs">
									<div className="text-[15px] font-semibold text-[#edf3d2]">Photo &amp; Video Access</div>
									<div className="text-[13px] text-[#9e998c]">
										Allow Concord to show your recent photos and videos right here.
									</div>
								</div>
								<button
									type="button"
									onClick={() => void triggerNativePermission()}
									className="mt-1 px-4 py-2.5 rounded-xl bg-[#cedb9c] text-[#050a08] hover:bg-[#dce7b0] text-[14px] font-semibold cursor-pointer transition"
								>
									Allow Photo &amp; Video Access
								</button>
							</div>
						) : nativePerm === 'checking' || (loadingNative && nativeItems.length === 0) ? (
							<div className="grid grid-cols-3 gap-1.5 pb-2">
								{Array.from({ length: 9 }).map((_, idx) => (
									<div key={idx} className="aspect-square rounded-xl bg-[#0f1f19] animate-pulse" />
								))}
							</div>
						) : nativeItems.length > 0 ? (
							<div className="space-y-2 pb-2">
								<div className="grid grid-cols-3 gap-1.5">
									{nativeItems.map((item) => {
										const selIdx = getSelectionIndex(item.id)
										const isSelected = selIdx >= 0
										const isOpening = openingNativeId === item.id
										return (
											<button
												key={item.id}
												type="button"
												disabled={Boolean(openingNativeId) && !isSelected}
												onClick={() => void toggleNativeItem(item)}
												className="aspect-square rounded-xl overflow-hidden bg-[#050a08] relative group cursor-pointer disabled:opacity-60"
											>
												{item.thumbnailDataUrl ? (
													<img
														src={item.thumbnailDataUrl}
														alt={item.filename}
														loading="lazy"
														className={`w-full h-full object-cover transition duration-200 ${
															isSelected ? 'scale-95 brightness-75' : 'group-hover:scale-105'
														}`}
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-[#9e998c]">
														<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
															<rect x="3" y="3" width="18" height="18" rx="3" />
															<circle cx="8.5" cy="8.5" r="1.5" />
															<path d="M21 15l-5-5L5 21" />
														</svg>
													</div>
												)}
												{isSelected && (
													<span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#cedb9c] text-[#050a08] text-[12px] font-bold flex items-center justify-center shadow">
														{selIdx + 1}
													</span>
												)}
												{item.kind === 'video' && (
													<span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/70 text-[#edf3d2] flex items-center justify-center">
														<svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
															<path d="M6 4l15 8-15 8V4z" />
														</svg>
													</span>
												)}
												{isOpening && (
													<div className="absolute inset-0 bg-black/60 flex items-center justify-center">
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
										className="w-full py-2.5 rounded-xl bg-[#0f1f19] hover:bg-[#152a22] text-[13px] font-semibold text-[#edf3d2] disabled:opacity-50 cursor-pointer transition"
									>
										{loadingNative ? 'Loading…' : 'Load more'}
									</button>
								)}
							</div>
						) : (
							<button
								type="button"
								onClick={() => galleryInputRef.current?.click()}
								className="flex-1 min-h-[140px] w-full rounded-2xl bg-[#050a08] hover:bg-[#0f1f19] flex flex-col items-center justify-center gap-2.5 p-6 text-center transition cursor-pointer"
							>
								<span className="w-12 h-12 rounded-2xl bg-[#0f1f19] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-0.5">
									<div className="text-[15px] font-semibold text-[#edf3d2]">Browse Device Media</div>
									<div className="text-[13px] text-[#9e998c]">Select one or multiple photos &amp; videos</div>
								</div>
							</button>
						)}
					</div>
				) : (
					<div className="h-full flex flex-col">
						{galleryItems.length > 0 ? (
							<div className="grid grid-cols-3 gap-1.5 pb-2">
								{galleryItems.map((item) => {
									const selIdx = getSelectionIndex(item.id)
									const isSelected = selIdx >= 0
									return (
										<button
											key={item.id}
											type="button"
											onClick={() => toggleGalleryItem(item)}
											className="aspect-square rounded-xl overflow-hidden bg-[#050a08] relative group cursor-pointer"
										>
											{item.kind === 'video' ? (
												<>
													<video src={item.previewUrl} muted playsInline className="w-full h-full object-cover" />
													<span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/70 text-[#edf3d2] flex items-center justify-center">
														<svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
															<path d="M6 4l15 8-15 8V4z" />
														</svg>
													</span>
												</>
											) : (
												<img
													src={item.previewUrl}
													alt={item.file.name}
													className={`w-full h-full object-cover transition duration-200 ${
														isSelected ? 'scale-95 brightness-75' : 'group-hover:scale-105'
													}`}
												/>
											)}
											{isSelected && (
												<span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#cedb9c] text-[#050a08] text-[12px] font-bold flex items-center justify-center shadow">
													{selIdx + 1}
												</span>
											)}
										</button>
									)
								})}
								<button
									type="button"
									onClick={() => galleryInputRef.current?.click()}
									className="aspect-square rounded-xl bg-[#0f1f19] hover:bg-[#152a22] flex flex-col items-center justify-center gap-1.5 text-[#edf3d2] cursor-pointer transition"
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
								className="flex-1 min-h-[140px] w-full rounded-2xl bg-[#050a08] hover:bg-[#0f1f19] flex flex-col items-center justify-center gap-2.5 p-6 text-center transition cursor-pointer"
							>
								<span className="w-12 h-12 rounded-2xl bg-[#0f1f19] text-[#cedb9c] flex items-center justify-center">
									<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<div className="space-y-0.5">
									<div className="text-[15px] font-semibold text-[#edf3d2]">Open Device Gallery</div>
									<div className="text-[13px] text-[#9e998c]">
										Pick one or multiple photos &amp; videos
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
			<div className="px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#050a08] grid grid-cols-3 gap-3 shrink-0">
				<button
					type="button"
					onClick={() => galleryInputRef.current?.click()}
					className="flex flex-col items-center gap-1.5 cursor-pointer group"
				>
					<span className="w-11 h-11 rounded-2xl bg-[#0f1f19] group-hover:bg-[#152a22] text-[#edf3d2] flex items-center justify-center transition">
						<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<rect x="3" y="3" width="18" height="18" rx="3" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<path d="M21 15l-5-5L5 21" />
						</svg>
					</span>
					<span className="text-[12px] font-medium text-[#e5ebcd]/85">Gallery</span>
				</button>

				<button
					type="button"
					onClick={() => docInputRef.current?.click()}
					className="flex flex-col items-center gap-1.5 cursor-pointer group"
				>
					<span className="w-11 h-11 rounded-2xl bg-[#0f1f19] group-hover:bg-[#152a22] text-[#edf3d2] flex items-center justify-center transition">
						<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
						</svg>
					</span>
					<span className="text-[12px] font-medium text-[#e5ebcd]/85">File</span>
				</button>

				<button
					type="button"
					onClick={() => cameraInputRef.current?.click()}
					className="flex flex-col items-center gap-1.5 cursor-pointer group"
				>
					<span className="w-11 h-11 rounded-2xl bg-[#0f1f19] group-hover:bg-[#152a22] text-[#edf3d2] flex items-center justify-center transition">
						<svg className="w-5 h-5 text-[#cedb9c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
							<circle cx="12" cy="13" r="4" />
						</svg>
					</span>
					<span className="text-[12px] font-medium text-[#e5ebcd]/85">Camera</span>
				</button>
			</div>
		</div>
	)
}
