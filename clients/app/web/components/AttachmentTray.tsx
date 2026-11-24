import { useEffect, useRef, useState } from 'react'
import { getSession } from '../../lib/auth'
import { uploadFile } from '../../lib/storage'
import { isUuid } from '../../lib/url'
import type { FileAsset } from '../../lib/types'

interface AttachmentTrayProps {
	spaceId: string
	onClose: () => void
	onSendAsset: (asset: FileAsset, caption?: string) => void
	onSendSticker: (sticker: string) => void
}

type TrayTab = 'media' | 'docs' | 'voice' | 'stickers'
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
	trimStart: number
	trimEnd: number
}

const STICKERS = ['✦', '❖', '☾', '〰', '✎', '♪', '◈', '☄', '❀', '⌘', '⚡', '🕊']
const MAX_INLINE_VIDEO_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_INLINE_VIDEO_SECONDS = 60
const LEVEL_BAR_COUNT = 20

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

/**
 * Compresses an image client-side into WebP with optional 90-degree rotation and centered square crop.
 */
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

	let outW = sw
	let outH = sh
	if (outW > maxDim || outH > maxDim) {
		const ratio = Math.min(maxDim / outW, maxDim / outH)
		outW = Math.round(outW * ratio)
		outH = Math.round(outH * ratio)
	}

	const swap = rotationDeg % 180 !== 0
	const canvas = document.createElement('canvas')
	canvas.width = swap ? outH : outW
	canvas.height = swap ? outW : outH

	const ctx = canvas.getContext('2d')
	if (!ctx) {
		bitmap.close()
		return file
	}

	ctx.translate(canvas.width / 2, canvas.height / 2)
	ctx.rotate((rotationDeg * Math.PI) / 180)
	ctx.drawImage(bitmap, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH)
	bitmap.close()

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((b) => resolve(b), 'image/webp', 0.84)
	)
	if (!blob) return file

	const baseName = file.name.replace(/\.[^.]+$/, '')
	return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
}

/**
 * Probes a video file's duration using a hidden <video> element.
 */
function probeVideoDuration(previewUrl: string): Promise<number> {
	return new Promise((resolve) => {
		const video = document.createElement('video')
		video.preload = 'metadata'
		video.muted = true
		video.playsInline = true

		const cleanup = () => {
			video.removeAttribute('src')
			video.load()
		}

		video.onloadedmetadata = () => {
			const dur = Number.isFinite(video.duration) ? video.duration : Infinity
			cleanup()
			resolve(dur)
		}
		video.onerror = () => {
			cleanup()
			resolve(Infinity)
		}

		video.src = previewUrl
	})
}

function pickSupportedAudioMime(): string {
	if (typeof MediaRecorder === 'undefined') return 'audio/webm'
	const candidates = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/ogg;codecs=opus',
		'audio/ogg',
	]
	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) return mime
	}
	return 'audio/webm'
}

export function AttachmentTray({ spaceId, onClose, onSendAsset, onSendSticker }: AttachmentTrayProps) {
	const [tab, setTab] = useState<TrayTab>('media')
	const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
	const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null)
	const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null)
	const [caption, setCaption] = useState('')
	const [uploading, setUploading] = useState(false)
	const [uploadNotice, setUploadNotice] = useState<string | null>(null)
	const [statusMsg, setStatusMsg] = useState<string | null>(null)

	// Voice recorder state
	const [isRecording, setIsRecording] = useState(false)
	const [recordingSeconds, setRecordingSeconds] = useState(0)
	const [levelBars, setLevelBars] = useState<number[]>(() => Array(LEVEL_BAR_COUNT).fill(12))
	const [recordedVoice, setRecordedVoice] = useState<RecordedVoice | null>(null)
	const [isPlayingVoice, setIsPlayingVoice] = useState(false)
	const [voiceCurrentTime, setVoiceCurrentTime] = useState(0)

	const imgInputRef = useRef<HTMLInputElement>(null)
	const videoInputRef = useRef<HTMLInputElement>(null)
	const docInputRef = useRef<HTMLInputElement>(null)

	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const mediaStreamRef = useRef<MediaStream | null>(null)
	const audioContextRef = useRef<AudioContext | null>(null)
	const animFrameRef = useRef<number | null>(null)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const recordingStartRef = useRef<number>(0)
	const voiceAudioRef = useRef<HTMLAudioElement | null>(null)

	const stopRecordingInternals = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
		if (animFrameRef.current !== null) {
			cancelAnimationFrame(animFrameRef.current)
			animFrameRef.current = null
		}
		if (audioContextRef.current) {
			void audioContextRef.current.close().catch(() => {})
			audioContextRef.current = null
		}
		if (mediaStreamRef.current) {
			for (const track of mediaStreamRef.current.getTracks()) {
				track.stop()
			}
			mediaStreamRef.current = null
		}
		setLevelBars(Array(LEVEL_BAR_COUNT).fill(12))
	}

	const clearPendingMedia = () => {
		if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
		if (pendingVideo) URL.revokeObjectURL(pendingVideo.previewUrl)
		if (recordedVoice) URL.revokeObjectURL(recordedVoice.previewUrl)
		setPendingImage(null)
		setPendingVideo(null)
		setPendingDoc(null)
		setRecordedVoice(null)
		setIsPlayingVoice(false)
		setVoiceCurrentTime(0)
		setCaption('')
		setUploadNotice(null)
		setStatusMsg(null)
	}

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
			// R2 upload succeeded — revoke unused local fallback blob URL
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
			// Demo/offline mode: keep fallback URL alive for local preview in chat
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

	const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPendingMedia()
		const previewUrl = trackPreviewUrl(URL.createObjectURL(file))
		setPendingImage({ file, previewUrl, rotation: 0, cropMode: 'original' })
	}

	const handleSelectVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPendingMedia()

		const previewUrl = trackPreviewUrl(URL.createObjectURL(file))
		const withinSize = file.size <= MAX_INLINE_VIDEO_BYTES
		const duration = withinSize ? await probeVideoDuration(previewUrl) : Infinity
		if (!isMountedRef.current) {
			releasePreviewUrl(previewUrl)
			return
		}
		const withinThreshold = withinSize && duration <= MAX_INLINE_VIDEO_SECONDS

		if (withinThreshold) {
			setPendingVideo({
				file,
				previewUrl,
				duration,
				muted: false,
			})
			return
		}

		// Larger than 25 MB or longer than 60s -> stream straight to R2 without blocking in the editor
		setUploading(true)
		setUploadNotice('Video exceeds 25 MB or 60s — streaming directly to R2...')
		setStatusMsg(null)
		try {
			const asset = await uploadAssetOrFallback(
				file,
				'video',
				previewUrl,
				Number.isFinite(duration) ? `Video (${formatSeconds(duration)})` : undefined
			)
			onSendAsset(asset)
			onClose()
		} catch (err) {
			releasePreviewUrl(previewUrl)
			setStatusMsg(err instanceof Error ? err.message : 'Video upload failed')
		} finally {
			setUploading(false)
			setUploadNotice(null)
		}
	}

	const handleSelectDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		clearPendingMedia()

		const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
		let textPreview: string | undefined
		if (
			!isPdf &&
			(file.type.startsWith('text/') ||
				file.type === 'application/json' ||
				/\.(md|txt|json|csv|ts|tsx|js|jsx|py|go|rs|ex|exs|css|html|yaml|yml|toml|xml)$/i.test(file.name))
		) {
			const text = await file.text()
			textPreview = text.slice(0, 4000)
		}

		setPendingDoc({ file, isPdf, textPreview })
	}

	const handleUploadAndSend = async () => {
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
				const note = pendingVideo.muted
					? `Muted clip (${formatSeconds(pendingVideo.duration)})`
					: `Video clip (${formatSeconds(pendingVideo.duration)})`
				asset = await uploadAssetOrFallback(pendingVideo.file, 'video', pendingVideo.previewUrl, note)
			} else if (pendingDoc) {
				const fallbackUrl = pendingDoc.isPdf ? trackPreviewUrl(URL.createObjectURL(pendingDoc.file)) : '#'
				asset = await uploadAssetOrFallback(
					pendingDoc.file,
					'doc',
					fallbackUrl,
					pendingDoc.textPreview
				)
			} else {
				return
			}

			onSendAsset(asset, caption.trim() || undefined)
			setPendingImage(null)
			setPendingVideo(null)
			setPendingDoc(null)
			setCaption('')
			onClose()
		} catch (err) {
			setStatusMsg(err instanceof Error ? err.message : 'Upload failed')
		} finally {
			setUploading(false)
		}
	}

	// Voice Note Recording
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
				const elapsedSec = Math.max(1, (Date.now() - recordingStartRef.current) / 1000)
				const finalMime = recorder.mimeType || mimeType
				const blob = new Blob(chunksRef.current, { type: finalMime })
				const previewUrl = trackPreviewUrl(URL.createObjectURL(blob))
				const roundedDur = Math.max(1, Math.round(elapsedSec * 10) / 10)
				setRecordedVoice({
					blob,
					mimeType: finalMime,
					previewUrl,
					duration: roundedDur,
					trimStart: 0,
					trimEnd: roundedDur,
				})
				setVoiceCurrentTime(0)
				setIsRecording(false)
				stopRecordingInternals()
			}

			// Web Audio analyser for live level bars
			try {
				const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				const audioCtx = new AudioCtx()
				audioContextRef.current = audioCtx
				const source = audioCtx.createMediaStreamSource(stream)
				const analyser = audioCtx.createAnalyser()
				analyser.fftSize = 64
				source.connect(analyser)

				const freqData = new Uint8Array(analyser.frequencyBinCount)
				const updateLevels = () => {
					analyser.getByteFrequencyData(freqData)
					const bars: number[] = []
					const step = Math.max(1, Math.floor(freqData.length / LEVEL_BAR_COUNT))
					for (let i = 0; i < LEVEL_BAR_COUNT; i++) {
						const val = freqData[i * step] ?? 0
						bars.push(Math.max(14, Math.min(100, Math.round((val / 255) * 100))))
					}
					setLevelBars(bars)
					animFrameRef.current = requestAnimationFrame(updateLevels)
				}
				animFrameRef.current = requestAnimationFrame(updateLevels)
			} catch {
				// Fallback animated bars when AudioContext is unavailable
				const tickFallback = () => {
					setLevelBars(
						Array.from({ length: LEVEL_BAR_COUNT }, (_, i) =>
							Math.round(25 + Math.abs(Math.sin(Date.now() / 180 + i * 0.6)) * 60)
						)
					)
					animFrameRef.current = requestAnimationFrame(tickFallback)
				}
				animFrameRef.current = requestAnimationFrame(tickFallback)
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

	const cancelVoiceRecording = () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			mediaRecorderRef.current.onstop = null
			mediaRecorderRef.current.stop()
		}
		stopRecordingInternals()
		setIsRecording(false)
		setRecordingSeconds(0)
	}

	const toggleVoicePlayback = () => {
		const el = voiceAudioRef.current
		if (!el || !recordedVoice) return
		if (isPlayingVoice) {
			el.pause()
			setIsPlayingVoice(false)
			return
		}
		if (el.currentTime < recordedVoice.trimStart || el.currentTime >= recordedVoice.trimEnd) {
			el.currentTime = recordedVoice.trimStart
		}
		void el.play().then(() => setIsPlayingVoice(true)).catch(() => setIsPlayingVoice(false))
	}

	const handleSendVoice = async () => {
		if (!recordedVoice) return
		setUploading(true)
		setStatusMsg(null)
		try {
			const ext = recordedVoice.mimeType.includes('ogg') ? 'ogg' : 'webm'
			const filename = `voice-note-${Date.now()}.${ext}`
			const audioFile = new File([recordedVoice.blob], filename, {
				type: recordedVoice.mimeType.split(';')[0] || `audio/${ext}`,
			})
			const trimmedLen = Math.max(0.5, recordedVoice.trimEnd - recordedVoice.trimStart)
			const isTrimmed = recordedVoice.trimStart > 0.1 || recordedVoice.trimEnd < recordedVoice.duration - 0.1
			const summary = isTrimmed
				? `Voice note (${formatSeconds(recordedVoice.trimStart)}-${formatSeconds(recordedVoice.trimEnd)}, ${trimmedLen.toFixed(1)}s)`
				: `Voice note (${trimmedLen.toFixed(1)}s)`

			const asset = await uploadAssetOrFallback(audioFile, 'audio', recordedVoice.previewUrl, summary)
			onSendAsset(asset, caption.trim() || undefined)
			setRecordedVoice(null)
			setCaption('')
			onClose()
		} catch (err) {
			setStatusMsg(err instanceof Error ? err.message : 'Voice upload failed')
		} finally {
			setUploading(false)
		}
	}

	const handleTabChange = (nextTab: TrayTab) => {
		if (isRecording) cancelVoiceRecording()
		clearPendingMedia()
		setTab(nextTab)
	}

	const hasActivePreview = Boolean(pendingImage || pendingVideo || pendingDoc)

	return (
		<div className="border-t border-white/[0.08] bg-[#111115] px-4 py-3 space-y-3">
			{/* Tray Tabs */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] overflow-x-auto no-scrollbar">
					{(
						[
							['media', 'Media'],
							['docs', 'Docs'],
							['voice', 'Voice'],
							['stickers', 'Stickers & GIFs'],
						] as [TrayTab, string][]
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => handleTabChange(key)}
							className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
								tab === key ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
							}`}
						>
							{label}
						</button>
					))}
				</div>

				<button
					type="button"
					onClick={() => {
						if (isRecording) cancelVoiceRecording()
						onClose()
					}}
					aria-label="Close attachment tray"
					className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-white/[0.05] cursor-pointer shrink-0"
				>
					<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
					<span>Close</span>
				</button>
			</div>

			{/* Hidden File Inputs */}
			<input ref={imgInputRef} type="file" accept="image/*" onChange={handleSelectImage} className="hidden" />
			<input ref={videoInputRef} type="file" accept="video/*" onChange={handleSelectVideo} className="hidden" />
			<input
				ref={docInputRef}
				type="file"
				accept=".md,.txt,.pdf,.json,.csv,.ts,.tsx,.js,.jsx,.py,.go,.rs,.ex,.exs,.css,.html,.yaml,.yml,.toml,.xml,.doc,.docx"
				onChange={handleSelectDoc}
				className="hidden"
			/>

			{/* Background streaming notice for large/long videos */}
			{uploadNotice && (
				<div className="rounded-2xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-zinc-200">
					<svg className="w-4 h-4 text-[#a78bfa] animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
						<path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
					</svg>
					<span>{uploadNotice}</span>
				</div>
			)}

			{/* Image Editor Preview */}
			{pendingImage && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3 space-y-3">
					<div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
						<span className="truncate">Image Editor / WebP Compression</span>
						<div className="flex items-center gap-1.5 shrink-0">
							<button
								type="button"
								onClick={() =>
									setPendingImage((p) =>
										p ? { ...p, cropMode: p.cropMode === 'original' ? 'square' : 'original' } : null
									)
								}
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
									pendingImage.cropMode === 'square'
										? 'bg-[#8b5cf6]/25 text-[#c4b5fd] border border-[#8b5cf6]/40'
										: 'bg-white/[0.06] hover:bg-white/12 text-zinc-200 border border-transparent'
								}`}
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" />
								</svg>
								<span>{pendingImage.cropMode === 'square' ? '1:1 Square' : 'Original'}</span>
							</button>
							<button
								type="button"
								onClick={() =>
									setPendingImage((p) => (p ? { ...p, rotation: (p.rotation + 90) % 360 } : null))
								}
								className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-zinc-200 cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6"
									/>
								</svg>
								<span>Rotate 90°</span>
							</button>
							<button
								type="button"
								onClick={clearPendingMedia}
								aria-label="Discard image"
								className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
					<div className="flex justify-center overflow-hidden rounded-xl bg-black/50 max-h-52 py-2">
						<div
							className={
								pendingImage.cropMode === 'square'
									? 'w-44 h-44 overflow-hidden rounded-lg border border-white/15'
									: 'max-h-48 flex items-center justify-center'
							}
						>
							<img
								src={pendingImage.previewUrl}
								alt="Preview"
								style={{ transform: `rotate(${pendingImage.rotation}deg)` }}
								className={
									pendingImage.cropMode === 'square'
										? 'w-full h-full object-cover transition-transform duration-200'
										: 'max-h-48 object-contain transition-transform duration-200'
								}
							/>
						</div>
					</div>
					<div className="flex gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a caption..."
							className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#8b5cf6]/50"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleUploadAndSend}
							className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
						>
							{uploading ? 'Sending...' : 'Send'}
						</button>
					</div>
				</div>
			)}

			{/* Inline Video Preview (<= 25 MB and <= 60s) */}
			{pendingVideo && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3 space-y-3">
					<div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
						<span className="truncate">
							{pendingVideo.file.name} ({formatBytes(pendingVideo.file.size)}, {formatSeconds(pendingVideo.duration)})
						</span>
						<div className="flex items-center gap-1.5 shrink-0">
							<button
								type="button"
								onClick={() =>
									setPendingVideo((v) => (v ? { ...v, muted: !v.muted } : null))
								}
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
									pendingVideo.muted
										? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
										: 'bg-white/[0.06] hover:bg-white/12 text-zinc-200 border border-transparent'
								}`}
							>
								{pendingVideo.muted ? (
									<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
									</svg>
								) : (
									<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
										/>
									</svg>
								)}
								<span>{pendingVideo.muted ? 'Muted' : 'Sound On'}</span>
							</button>
							<button
								type="button"
								onClick={clearPendingMedia}
								aria-label="Discard video"
								className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
					<div className="flex justify-center overflow-hidden rounded-xl bg-black max-h-52">
						<video
							src={pendingVideo.previewUrl}
							controls
							muted={pendingVideo.muted}
							playsInline
							className="max-h-52 w-full object-contain"
						/>
					</div>
					<div className="flex gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a caption for this video..."
							className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#8b5cf6]/50"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleUploadAndSend}
							className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
						>
							{uploading ? 'Uploading...' : 'Send Video'}
						</button>
					</div>
				</div>
			)}

			{/* Document Preview */}
			{pendingDoc && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3 space-y-2.5">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							<svg className="w-4 h-4 text-[#a78bfa] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
							</svg>
							<div className="text-xs font-semibold text-zinc-200 truncate">{pendingDoc.file.name}</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<span className="text-[10px] text-zinc-500">{formatBytes(pendingDoc.file.size)}</span>
							<button
								type="button"
								onClick={clearPendingMedia}
								aria-label="Discard document"
								className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
					{pendingDoc.isPdf ? (
						<div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5 flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
								<span className="text-[11px] font-bold tracking-wide text-rose-300">PDF</span>
							</div>
							<div className="min-w-0">
								<div className="text-xs font-medium text-zinc-200 truncate">{pendingDoc.file.name}</div>
								<div className="text-[11px] text-zinc-500 mt-0.5">
									PDF document ({formatBytes(pendingDoc.file.size)}) — opens in the native PDF viewer.
								</div>
							</div>
						</div>
					) : pendingDoc.textPreview ? (
						<pre className="max-h-36 overflow-y-auto rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-[11px] text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
							{pendingDoc.textPreview}
						</pre>
					) : (
						<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-xs text-zinc-400">
							Ready to attach and preview inside this Space.
						</div>
					)}
					<div className="flex gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a note about this document..."
							className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#8b5cf6]/50"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleUploadAndSend}
							className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
						>
							{uploading ? 'Uploading...' : 'Send Doc'}
						</button>
					</div>
				</div>
			)}

			{/* Default Media Tab */}
			{!hasActivePreview && tab === 'media' && (
				<div className="grid grid-cols-2 gap-2.5">
					<button
						type="button"
						onClick={() => imgInputRef.current?.click()}
						className="rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-white/[0.04] p-4 text-center transition cursor-pointer flex flex-col items-center gap-1.5"
					>
						<svg className="w-5 h-5 text-[#a78bfa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
							<rect x="3" y="3" width="18" height="18" rx="3" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
						</svg>
						<div className="text-xs font-semibold text-zinc-200">Pick Image</div>
						<div className="text-[11px] text-zinc-500">Rotate, crop & WebP compress</div>
					</button>
					<button
						type="button"
						disabled={uploading}
						onClick={() => videoInputRef.current?.click()}
						className="rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-white/[0.04] p-4 text-center transition cursor-pointer disabled:opacity-50 flex flex-col items-center gap-1.5"
					>
						<svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
							<rect x="2" y="5" width="15" height="14" rx="2.5" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M17 10l5-3v10l-5-3v-4z" />
						</svg>
						<div className="text-xs font-semibold text-zinc-200">Pick Video</div>
						<div className="text-[11px] text-zinc-500">Preview &le;25MB/60s, or stream to R2</div>
					</button>
				</div>
			)}

			{/* Default Docs Tab */}
			{!hasActivePreview && tab === 'docs' && (
				<button
					type="button"
					onClick={() => docInputRef.current?.click()}
					className="w-full rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-white/[0.04] p-5 text-center transition cursor-pointer flex flex-col items-center gap-1.5"
				>
					<svg className="w-5 h-5 text-[#a78bfa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
						<path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
						<path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h6" />
					</svg>
					<div className="text-xs font-semibold text-zinc-200">Choose Document (MD, PDF, TXT, Code, JSON, CSV)</div>
					<div className="text-[11px] text-zinc-500">Instant in-tray preview before uploading to R2</div>
				</button>
			)}

			{/* Voice Note Recorder Tab */}
			{tab === 'voice' && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3.5 space-y-3">
					{!isRecording && !recordedVoice && (
						<div className="flex items-center justify-between gap-3">
							<div className="space-y-0.5">
								<div className="text-xs font-semibold text-zinc-200">Voice Note Recorder</div>
								<div className="text-[11px] text-zinc-500">
									Record audio, preview and trim, then upload to R2
								</div>
							</div>
							<button
								type="button"
								onClick={startVoiceRecording}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white transition cursor-pointer shrink-0"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="9" y="2" width="6" height="12" rx="3" />
									<path strokeLinecap="round" strokeLinejoin="round" d="M5 10a7 7 0 0014 0M12 19v3M8 22h8" />
								</svg>
								<span>Record</span>
							</button>
						</div>
					)}

					{isRecording && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
									<span className="text-xs font-semibold text-zinc-100">Recording</span>
									<span className="text-xs font-mono text-[#a78bfa]">{formatSeconds(recordingSeconds)}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										onClick={cancelVoiceRecording}
										className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs text-zinc-300 cursor-pointer"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={stopVoiceRecording}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-semibold text-white cursor-pointer"
									>
										<svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
											<rect x="5" y="5" width="14" height="14" rx="2" />
										</svg>
										<span>Stop</span>
									</button>
								</div>
							</div>

							{/* Live animated level bars */}
							<div className="h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 flex items-center justify-between gap-1">
								{levelBars.map((level, idx) => (
									<div
										key={idx}
										style={{ height: `${Math.max(14, level)}%` }}
										className="flex-1 rounded-full bg-gradient-to-t from-[#8b5cf6] to-[#c4b5fd] transition-all duration-75"
									/>
								))}
							</div>
						</div>
					)}

					{!isRecording && recordedVoice && (
						<div className="space-y-3">
							<audio
								ref={voiceAudioRef}
								src={recordedVoice.previewUrl}
								onLoadedMetadata={(e) => {
									const d = e.currentTarget.duration
									if (Number.isFinite(d) && d > 0) {
										const rounded = Math.round(d * 10) / 10
										setRecordedVoice((prev) =>
											prev
												? {
														...prev,
														duration: rounded,
														trimStart: Math.min(prev.trimStart, Math.max(0, rounded - 0.5)),
														trimEnd: rounded,
												  }
												: null
										)
									}
								}}
								onTimeUpdate={(e) => {
									const t = e.currentTarget.currentTime
									setVoiceCurrentTime(t)
									if (t >= recordedVoice.trimEnd) {
										e.currentTarget.pause()
										setIsPlayingVoice(false)
									}
								}}
								onEnded={() => setIsPlayingVoice(false)}
								className="hidden"
							/>

							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2.5">
									<button
										type="button"
										onClick={toggleVoicePlayback}
										aria-label={isPlayingVoice ? 'Pause voice note' : 'Play voice note'}
										className="w-8 h-8 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white flex items-center justify-center cursor-pointer shrink-0"
									>
										{isPlayingVoice ? (
											<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
												<rect x="6" y="4" width="4" height="16" rx="1" />
												<rect x="14" y="4" width="4" height="16" rx="1" />
											</svg>
										) : (
											<svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
												<path d="M6 4l15 8-15 8V4z" />
											</svg>
										)}
									</button>
									<div>
										<div className="text-xs font-semibold text-zinc-200">Voice Note Preview</div>
										<div className="text-[11px] font-mono text-zinc-400">
											{voiceCurrentTime.toFixed(1)}s / {recordedVoice.duration.toFixed(1)}s
											<span className="text-zinc-500 ml-2">
												(Trim: {recordedVoice.trimStart.toFixed(1)}s - {recordedVoice.trimEnd.toFixed(1)}s)
											</span>
										</div>
									</div>
								</div>

								<button
									type="button"
									onClick={startVoiceRecording}
									className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 cursor-pointer"
								>
									Re-record
								</button>
							</div>

							{/* Start / End Trim Sliders */}
							<div className="grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
								<label className="space-y-1">
									<div className="flex items-center justify-between text-[11px] text-zinc-400">
										<span>Trim Start</span>
										<span className="font-mono text-zinc-300">{recordedVoice.trimStart.toFixed(1)}s</span>
									</div>
									<input
										type="range"
										min={0}
										max={Math.max(0, recordedVoice.trimEnd - 0.5)}
										step={0.1}
										value={recordedVoice.trimStart}
										onChange={(e) => {
											const val = Number(e.target.value)
											setRecordedVoice((prev) => (prev ? { ...prev, trimStart: val } : null))
										}}
										className="w-full accent-[#8b5cf6] cursor-pointer"
									/>
								</label>
								<label className="space-y-1">
									<div className="flex items-center justify-between text-[11px] text-zinc-400">
										<span>Trim End</span>
										<span className="font-mono text-zinc-300">{recordedVoice.trimEnd.toFixed(1)}s</span>
									</div>
									<input
										type="range"
										min={Math.min(recordedVoice.duration, recordedVoice.trimStart + 0.5)}
										max={recordedVoice.duration}
										step={0.1}
										value={recordedVoice.trimEnd}
										onChange={(e) => {
											const val = Number(e.target.value)
											setRecordedVoice((prev) => (prev ? { ...prev, trimEnd: val } : null))
										}}
										className="w-full accent-[#8b5cf6] cursor-pointer"
									/>
								</label>
							</div>

							<div className="flex gap-2">
								<input
									type="text"
									value={caption}
									onChange={(e) => setCaption(e.target.value)}
									placeholder="Add a note for this voice message..."
									className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#8b5cf6]/50"
								/>
								<button
									type="button"
									disabled={uploading}
									onClick={handleSendVoice}
									className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
								>
									{uploading ? 'Uploading...' : 'Send Voice'}
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Stickers & GIFs Tab */}
			{!hasActivePreview && tab === 'stickers' && (
				<div className="grid grid-cols-6 gap-2">
					{STICKERS.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => {
								onSendSticker(s)
								onClose()
							}}
							className="aspect-square rounded-xl bg-white/[0.04] hover:bg-[#8b5cf6]/20 border border-white/[0.06] text-xl flex items-center justify-center transition cursor-pointer"
						>
							{s}
						</button>
					))}
				</div>
			)}

			{statusMsg && <p className="text-xs text-rose-400">{statusMsg}</p>}
		</div>
	)
}
