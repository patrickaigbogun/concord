import { useEffect, useRef, useState } from 'react'
import { getSession } from '../../lib/auth'
import { uploadFile } from '../../lib/storage'
import { isUuid, safeMediaUrl } from '../../lib/url'
import type { FileAsset } from '../../lib/types'

interface AttachmentTrayProps {
	spaceId: string
	recentMedia?: FileAsset[]
	onClose: () => void
	onSendAsset: (asset: FileAsset, caption?: string) => void
}

type CropMode = 'original' | 'square'

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

interface RecordedVoice {
	blob: Blob
	mimeType: string
	previewUrl: string
	duration: number
}

const MAX_INLINE_VIDEO_BYTES = 25 * 1024 * 1024
const MAX_INLINE_VIDEO_SECONDS = 60
const LEVEL_BAR_COUNT = 22

function formatSeconds(sec: number): string {
	const safe = Math.max(0, Math.floor(sec))
	const m = Math.floor(safe / 60)
	const s = safe % 60
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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

function pickSupportedAudioMime(): string {
	if (typeof MediaRecorder === 'undefined') return 'audio/webm'
	const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) return mime
	}
	return 'audio/webm'
}

export function AttachmentTray({
	spaceId,
	recentMedia = [],
	onClose,
	onSendAsset,
}: AttachmentTrayProps) {
	const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
	const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null)
	const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null)
	const [recordedVoice, setRecordedVoice] = useState<RecordedVoice | null>(null)
	const [voiceMode, setVoiceMode] = useState(false)
	const [isRecording, setIsRecording] = useState(false)
	const [recordingSeconds, setRecordingSeconds] = useState(0)
	const [levelBars, setLevelBars] = useState<number[]>(() => Array(LEVEL_BAR_COUNT).fill(18))

	const [caption, setCaption] = useState('')
	const [uploading, setUploading] = useState(false)
	const [statusMsg, setStatusMsg] = useState<string | null>(null)

	const galleryInputRef = useRef<HTMLInputElement>(null)
	const cameraInputRef = useRef<HTMLInputElement>(null)
	const docInputRef = useRef<HTMLInputElement>(null)

	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const mediaStreamRef = useRef<MediaStream | null>(null)
	const audioContextRef = useRef<AudioContext | null>(null)
	const animFrameRef = useRef<number | null>(null)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const recordingStartRef = useRef<number>(0)
	const chunksRef = useRef<Blob[]>([])
	const isMountedRef = useRef(true)
	const isStartingRecordingRef = useRef(false)
	const activePreviewUrlsRef = useRef<Set<string>>(new Set())

	const trackPreviewUrl = (url: string) => {
		if (url.startsWith('blob:')) activePreviewUrlsRef.current.add(url)
		return url
	}

	const releasePreviewUrl = (url?: string | null) => {
		if (!url || !url.startsWith('blob:')) return
		activePreviewUrlsRef.current.delete(url)
		URL.revokeObjectURL(url)
	}

	const stopRecordingInternals = () => {
		if (animFrameRef.current !== null) {
			cancelAnimationFrame(animFrameRef.current)
			animFrameRef.current = null
		}
		if (timerRef.current !== null) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
		if (audioContextRef.current) {
			void audioContextRef.current.close().catch(() => {})
			audioContextRef.current = null
		}
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((t) => t.stop())
			mediaStreamRef.current = null
		}
	}

	const clearPending = () => {
		if (pendingImage) releasePreviewUrl(pendingImage.previewUrl)
		if (pendingVideo) releasePreviewUrl(pendingVideo.previewUrl)
		if (recordedVoice) releasePreviewUrl(recordedVoice.previewUrl)
		setPendingImage(null)
		setPendingVideo(null)
		setPendingDoc(null)
		setRecordedVoice(null)
		setCaption('')
		setStatusMsg(null)
	}

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
				mediaRecorderRef.current.onstop = null
				mediaRecorderRef.current.stop()
			}
			stopRecordingInternals()
			for (const url of activePreviewUrlsRef.current) {
				URL.revokeObjectURL(url)
			}
			activePreviewUrlsRef.current.clear()
		}
	}, [])

	const uploadAssetOrFallback = async (
		file: File,
		kind: FileAsset['kind'],
		fallbackUrl: string,
		previewText?: string
	): Promise<FileAsset> => {
		const isLiveSignedIn = Boolean(getSession()?.access_token && isUuid(spaceId))
		try {
			const uploaded = await uploadFile(file, isUuid(spaceId) ? spaceId : undefined)
			releasePreviewUrl(fallbackUrl)
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
				releasePreviewUrl(fallbackUrl)
				throw err instanceof Error ? err : new Error('Upload to Concord R2 failed')
			}
			activePreviewUrlsRef.current.delete(fallbackUrl)
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

	const handlePickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPending()
		setVoiceMode(false)

		if (file.type.startsWith('video/')) {
			const previewUrl = trackPreviewUrl(URL.createObjectURL(file))
			const withinSize = file.size <= MAX_INLINE_VIDEO_BYTES
			const duration = withinSize ? await probeVideoDuration(previewUrl) : Infinity
			if (!isMountedRef.current) {
				releasePreviewUrl(previewUrl)
				return
			}
			if (withinSize && duration <= MAX_INLINE_VIDEO_SECONDS) {
				setPendingVideo({ file, previewUrl, duration, muted: false })
				return
			}
			setUploading(true)
			try {
				const asset = await uploadAssetOrFallback(file, 'video', previewUrl)
				onSendAsset(asset)
				onClose()
			} catch (err) {
				releasePreviewUrl(previewUrl)
				setStatusMsg(err instanceof Error ? err.message : 'Video upload failed')
			} finally {
				setUploading(false)
			}
			return
		}

		const previewUrl = trackPreviewUrl(URL.createObjectURL(file))
		setPendingImage({ file, previewUrl, rotation: 0, cropMode: 'original' })
	}

	const handlePickDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPending()
		setVoiceMode(false)

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
				const fallbackUrl = trackPreviewUrl(URL.createObjectURL(optimized))
				asset = await uploadAssetOrFallback(optimized, 'image', fallbackUrl)
				releasePreviewUrl(pendingImage.previewUrl)
			} else if (pendingVideo) {
				asset = await uploadAssetOrFallback(pendingVideo.file, 'video', pendingVideo.previewUrl)
			} else if (pendingDoc) {
				const fallbackUrl = pendingDoc.isPdf ? trackPreviewUrl(URL.createObjectURL(pendingDoc.file)) : '#'
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

	const startVoiceRecording = async () => {
		if (isRecording || isStartingRecordingRef.current) return
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			setStatusMsg('Voice recording is not supported in this browser.')
			return
		}
		if (recordedVoice) {
			releasePreviewUrl(recordedVoice.previewUrl)
			setRecordedVoice(null)
		}
		setStatusMsg(null)
		isStartingRecordingRef.current = true
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			if (!isMountedRef.current) {
				stream.getTracks().forEach((t) => t.stop())
				return
			}
			mediaStreamRef.current = stream
			chunksRef.current = []
			const mimeType = pickSupportedAudioMime()
			const recorder = new MediaRecorder(stream, { mimeType })
			mediaRecorderRef.current = recorder

			recorder.ondataavailable = (ev) => {
				if (ev.data.size > 0) chunksRef.current.push(ev.data)
			}
			recorder.onstop = () => {
				const elapsed = Math.max(1, (Date.now() - recordingStartRef.current) / 1000)
				const finalMime = recorder.mimeType || mimeType
				const blob = new Blob(chunksRef.current, { type: finalMime })
				const previewUrl = trackPreviewUrl(URL.createObjectURL(blob))
				setRecordedVoice({ blob, mimeType: finalMime, previewUrl, duration: Math.round(elapsed) })
				setIsRecording(false)
				stopRecordingInternals()
			}

			try {
				const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				const audioCtx = new AudioCtx()
				audioContextRef.current = audioCtx
				const source = audioCtx.createMediaStreamSource(stream)
				const analyser = audioCtx.createAnalyser()
				analyser.fftSize = 64
				source.connect(analyser)
				const freqData = new Uint8Array(analyser.frequencyBinCount)
				const tick = () => {
					analyser.getByteFrequencyData(freqData)
					const bars: number[] = []
					const step = Math.max(1, Math.floor(freqData.length / LEVEL_BAR_COUNT))
					for (let i = 0; i < LEVEL_BAR_COUNT; i++) {
						const val = freqData[i * step] ?? 0
						bars.push(Math.max(16, Math.min(100, Math.round((val / 255) * 100))))
					}
					setLevelBars(bars)
					animFrameRef.current = requestAnimationFrame(tick)
				}
				animFrameRef.current = requestAnimationFrame(tick)
			} catch {
				// fallback quiet bars
			}

			recordingStartRef.current = Date.now()
			setRecordingSeconds(0)
			setIsRecording(true)
			recorder.start(200)
			timerRef.current = setInterval(() => {
				setRecordingSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000))
			}, 250)
		} catch (err) {
			stopRecordingInternals()
			setIsRecording(false)
			setStatusMsg(err instanceof Error ? err.message : 'Microphone access denied')
		} finally {
			isStartingRecordingRef.current = false
		}
	}

	const stopVoiceRecording = () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			mediaRecorderRef.current.stop()
		}
	}

	const handleSendVoice = async () => {
		if (!recordedVoice) return
		setUploading(true)
		setStatusMsg(null)
		try {
			const ext = recordedVoice.mimeType.includes('ogg') ? 'ogg' : 'webm'
			const audioFile = new File([recordedVoice.blob], `voice-${Date.now()}.${ext}`, {
				type: recordedVoice.mimeType.split(';')[0] || `audio/${ext}`,
			})
			const asset = await uploadAssetOrFallback(audioFile, 'audio', recordedVoice.previewUrl)
			onSendAsset(asset, caption.trim() || undefined)
			onClose()
		} catch (err) {
			setStatusMsg(err instanceof Error ? err.message : 'Voice upload failed')
		} finally {
			setUploading(false)
		}
	}

	const visualRecent = recentMedia.filter((m) => (m.kind === 'image' || m.kind === 'video') && safeMediaUrl(m.url))

	return (
		<div
			data-no-pane-swipe="true"
			className="bg-[#111116] px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] select-none"
		>
			{/* Hidden OS Pickers */}
			<input
				ref={galleryInputRef}
				type="file"
				accept="image/*,video/*"
				onChange={handlePickMedia}
				className="hidden"
			/>
			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				onChange={handlePickMedia}
				className="hidden"
			/>
			<input
				ref={docInputRef}
				type="file"
				accept=".pdf,.md,.txt,.json,.csv,.ts,.tsx,.js,.py,.go,.rs,.ex,.doc,.docx"
				onChange={handlePickDoc}
				className="hidden"
			/>

			{/* Active Preview: Image / Video / Doc */}
			{pendingImage || pendingVideo || pendingDoc ? (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<button
							type="button"
							onClick={clearPending}
							className="text-[14px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
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
										className="px-3 py-1.5 rounded-full bg-[#1a1a23] text-[13px] font-semibold text-zinc-200 cursor-pointer"
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
										className={`px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer ${
											pendingImage.cropMode === 'square'
												? 'bg-[#8b5cf6] text-white'
												: 'bg-[#1a1a23] text-zinc-200'
										}`}
									>
										1:1
									</button>
								</>
							)}
						</div>
					</div>

					{pendingImage && (
						<div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-56">
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
						<div className="rounded-2xl overflow-hidden bg-black">
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
						<div className="rounded-2xl bg-[#181820] p-4 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<div className="text-[15px] font-semibold text-white truncate">{pendingDoc.file.name}</div>
								<div className="text-[13px] text-zinc-400">{formatBytes(pendingDoc.file.size)}</div>
							</div>
							<span className="px-3 py-1 rounded-full bg-[#8b5cf6]/20 text-[#c4b5fd] text-[12px] font-bold">
								{pendingDoc.isPdf ? 'PDF' : 'FILE'}
							</span>
						</div>
					)}

					<div className="flex items-center gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a caption…"
							className="flex-1 rounded-2xl bg-[#181820] px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleSendPending}
							className="px-5 py-3 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-[14px] font-bold cursor-pointer shrink-0"
						>
							{uploading ? 'Sending…' : 'Send'}
						</button>
					</div>
				</div>
			) : voiceMode ? (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<button
							type="button"
							onClick={() => {
								if (isRecording) stopVoiceRecording()
								clearPending()
								setVoiceMode(false)
							}}
							className="text-[14px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
						>
							Back
						</button>
						<span className="text-[14px] font-semibold text-white">Voice Note</span>
						<span className="text-[13px] font-mono text-zinc-400">{formatSeconds(recordingSeconds)}</span>
					</div>

					{recordedVoice ? (
						<div className="space-y-3">
							<audio src={recordedVoice.previewUrl} controls className="w-full h-10" />
							<div className="flex items-center justify-end gap-2">
								<button
									type="button"
									onClick={() => {
										releasePreviewUrl(recordedVoice.previewUrl)
										setRecordedVoice(null)
									}}
									className="px-4 py-2.5 rounded-2xl bg-[#1a1a23] text-[14px] font-semibold text-zinc-300 cursor-pointer"
								>
									Retake
								</button>
								<button
									type="button"
									disabled={uploading}
									onClick={handleSendVoice}
									className="px-5 py-2.5 rounded-2xl bg-white text-black text-[14px] font-bold cursor-pointer"
								>
									{uploading ? 'Sending…' : 'Send Voice'}
								</button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-4 py-3">
							<div className="flex items-end justify-center gap-1 h-12 w-full max-w-xs">
								{levelBars.map((h, i) => (
									<span
										key={i}
										style={{ height: `${isRecording ? h : 20}%` }}
										className={`w-1.5 rounded-full transition-all duration-75 ${
											isRecording ? 'bg-[#a78bfa]' : 'bg-zinc-700'
										}`}
									/>
								))}
							</div>
							<button
								type="button"
								onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
								className={`px-6 py-3 rounded-full text-[15px] font-bold transition cursor-pointer ${
									isRecording
										? 'bg-red-500 text-white hover:bg-red-600'
										: 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed]'
								}`}
							>
								{isRecording ? 'Stop Recording' : 'Tap to Record'}
							</button>
						</div>
					)}
				</div>
			) : (
				/* Clean Visual Media Sheet (Action Pills + Real Visual Media Grid — Zero Ugly Dashed Boxes) */
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-2">
						<div className="grid grid-cols-4 gap-2 flex-1">
							<button
								type="button"
								onClick={() => galleryInputRef.current?.click()}
								className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-[#181820] hover:bg-[#22222d] transition cursor-pointer"
							>
								<span className="w-10 h-10 rounded-full bg-[#8b5cf6]/20 text-[#c4b5fd] flex items-center justify-center">
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="3" width="18" height="18" rx="3" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</span>
								<span className="text-[12px] font-semibold text-zinc-200">Gallery</span>
							</button>

							<button
								type="button"
								onClick={() => cameraInputRef.current?.click()}
								className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-[#181820] hover:bg-[#22222d] transition cursor-pointer"
							>
								<span className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
										<circle cx="12" cy="13" r="4" />
									</svg>
								</span>
								<span className="text-[12px] font-semibold text-zinc-200">Camera</span>
							</button>

							<button
								type="button"
								onClick={() => docInputRef.current?.click()}
								className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-[#181820] hover:bg-[#22222d] transition cursor-pointer"
							>
								<span className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center">
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14 2 14 8 20 8" />
									</svg>
								</span>
								<span className="text-[12px] font-semibold text-zinc-200">Files</span>
							</button>

							<button
								type="button"
								onClick={() => setVoiceMode(true)}
								className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-[#181820] hover:bg-[#22222d] transition cursor-pointer"
							>
								<span className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center">
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
										<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
										<line x1="12" y1="19" x2="12" y2="23" />
									</svg>
								</span>
								<span className="text-[12px] font-semibold text-zinc-200">Voice</span>
							</button>
						</div>
					</div>

					{/* Visual Media Thumbnail Strip / Grid */}
					{visualRecent.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[12px] font-semibold text-zinc-400">Recent in Space</span>
								<button
									type="button"
									onClick={() => galleryInputRef.current?.click()}
									className="text-[12px] font-semibold text-[#a78bfa] hover:text-white cursor-pointer"
								>
									Browse device
								</button>
							</div>
							<div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto no-scrollbar">
								{visualRecent.slice(0, 9).map((item) => {
									const url = safeMediaUrl(item.url)
									if (!url) return null
									return (
										<button
											key={item.id}
											type="button"
											onClick={() => {
												onSendAsset({ ...item, id: `resend-${Date.now()}`, createdAt: 'Just now' })
												onClose()
											}}
											className="aspect-square rounded-2xl overflow-hidden bg-black relative group cursor-pointer"
										>
											{item.kind === 'video' ? (
												<video src={url} muted playsInline className="w-full h-full object-cover" />
											) : (
												<img src={url} alt={item.filename} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
											)}
										</button>
									)
								})}
							</div>
						</div>
					)}
				</div>
			)}

			{statusMsg && (
				<div className="mt-3 rounded-xl bg-red-500/15 px-3.5 py-2 text-[13px] text-red-300">
					{statusMsg}
				</div>
			)}
		</div>
	)
}
