import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileAsset } from '../../lib/types'

function formatDuration(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return '0:00'
	const total = Math.floor(sec)
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${m}:${s.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return ''
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDocTypeLabel(filename: string, contentType?: string): { ext: string; accent: string } {
	const lower = (filename || '').toLowerCase()
	if (lower.endsWith('.pdf') || contentType?.includes('pdf')) return { ext: 'PDF', accent: '#e07a5f' }
	if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { ext: 'DOC', accent: '#7fb3d5' }
	if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return { ext: 'XLS', accent: '#82c09a' }
	if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return { ext: 'PPT', accent: '#e8a87c' }
	if (lower.endsWith('.epub')) return { ext: 'EPUB', accent: '#cedb9c' }
	if (lower.endsWith('.md') || lower.endsWith('.txt')) return { ext: 'TXT', accent: '#cedb9c' }
	const parts = lower.split('.')
	const ext = parts.length > 1 ? parts[parts.length - 1].slice(0, 4).toUpperCase() : 'FILE'
	return { ext, accent: '#cedb9c' }
}

/** Deterministic organic waveform heights (0.18..1.0) seeded by string */
function generateWaveformBars(seedStr: string, count = 36): number[] {
	let h = 2166136261
	for (let i = 0; i < seedStr.length; i++) {
		h ^= seedStr.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	const bars: number[] = []
	for (let i = 0; i < count; i++) {
		h ^= h << 13
		h ^= h >>> 17
		h ^= h << 5
		const raw = ((h >>> 0) % 1000) / 1000
		// Envelope so ends taper slightly like natural speech
		const pos = i / (count - 1)
		const env = 0.55 + 0.45 * Math.sin(pos * Math.PI)
		bars.push(Math.max(0.18, Math.min(1, (0.22 + raw * 0.78) * env)))
	}
	return bars
}

export function VoiceNotePlayer({
	asset,
	url,
	isSelf,
}: {
	asset: FileAsset
	url: string
	isSelf?: boolean
}) {
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const waveformRef = useRef<HTMLDivElement | null>(null)
	const scrubbingRef = useRef(false)
	const [playing, setPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [rate, setRate] = useState<0.5 | 1 | 1.5 | 2>(1)
	const SPEED_STEPS: (0.5 | 1 | 1.5 | 2)[] = [0.5, 1, 1.5, 2]

	const bars = useMemo(
		() => generateWaveformBars(`${asset.id}-${asset.filename}`, 34),
		[asset.id, asset.filename]
	)

	useEffect(() => {
		const el = audioRef.current
		if (!el) return
		const onLoaded = () => {
			if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
		}
		const onTime = () => setCurrentTime(el.currentTime)
		const onEnded = () => {
			setPlaying(false)
			setCurrentTime(0)
		}
		const onPause = () => setPlaying(false)
		const onPlay = () => setPlaying(true)

		el.addEventListener('loadedmetadata', onLoaded)
		el.addEventListener('durationchange', onLoaded)
		el.addEventListener('timeupdate', onTime)
		el.addEventListener('ended', onEnded)
		el.addEventListener('pause', onPause)
		el.addEventListener('play', onPlay)
		return () => {
			el.removeEventListener('loadedmetadata', onLoaded)
			el.removeEventListener('durationchange', onLoaded)
			el.removeEventListener('timeupdate', onTime)
			el.removeEventListener('ended', onEnded)
			el.removeEventListener('pause', onPause)
			el.removeEventListener('play', onPlay)
		}
	}, [])

	const togglePlay = (e: React.MouseEvent) => {
		e.stopPropagation()
		const el = audioRef.current
		if (!el) return
		if (playing) {
			el.pause()
		} else {
			el.playbackRate = rate
			void el.play().catch(() => {})
		}
	}

	const selectRate = (next: 0.5 | 1 | 1.5 | 2, e: React.MouseEvent) => {
		e.stopPropagation()
		setRate(next)
		if (audioRef.current) audioRef.current.playbackRate = next
	}

	const scrubToClientX = (clientX: number) => {
		const el = audioRef.current
		const box = waveformRef.current
		if (!el || !box || !duration) return
		const rect = box.getBoundingClientRect()
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		el.currentTime = ratio * duration
		setCurrentTime(el.currentTime)
	}

	const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation()
		scrubbingRef.current = true
		e.currentTarget.setPointerCapture(e.pointerId)
		scrubToClientX(e.clientX)
	}

	const handleWaveformPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!scrubbingRef.current) return
		e.stopPropagation()
		scrubToClientX(e.clientX)
	}

	const handleWaveformPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!scrubbingRef.current) return
		e.stopPropagation()
		scrubbingRef.current = false
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
		}
	}

	const progress = duration > 0 ? currentTime / duration : 0

	return (
		<div
			data-no-pane-swipe="true"
			className={`min-w-[245px] sm:min-w-[280px] max-w-full flex flex-col gap-2 py-1 ${
				isSelf ? 'text-[#f2fbd0]' : 'text-[#e5ebcd]'
			}`}
		>
			<audio ref={audioRef} src={url} preload="metadata" className="hidden" />

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={togglePlay}
					aria-label={playing ? 'Pause' : 'Play'}
					className="w-10 h-10 rounded-full bg-[#cedb9c] text-[#050a08] hover:bg-[#dce7b0] flex items-center justify-center shrink-0 transition cursor-pointer shadow-md shadow-black/30"
				>
					{playing ? (
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
							<rect x="6" y="4" width="4" height="16" rx="1.2" />
							<rect x="14" y="4" width="4" height="16" rx="1.2" />
						</svg>
					) : (
						<svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
							<path d="M7 5.14v13.72a1 1 0 0 0 1.52.85l11.02-6.86a1 1 0 0 0 0-1.7L8.52 4.29A1 1 0 0 0 7 5.14z" />
						</svg>
					)}
				</button>

				<div className="flex-1 min-w-0 flex flex-col gap-1">
					<div
						ref={waveformRef}
						onPointerDown={handleWaveformPointerDown}
						onPointerMove={handleWaveformPointerMove}
						onPointerUp={handleWaveformPointerUp}
						onPointerCancel={handleWaveformPointerUp}
						role="slider"
						aria-label="Audio waveform"
						aria-valuemin={0}
						aria-valuemax={Math.round(duration)}
						aria-valuenow={Math.round(currentTime)}
						tabIndex={0}
						className="h-9 flex items-center gap-[2.5px] cursor-pointer select-none touch-none"
					>
						{bars.map((amp, idx) => {
							const barRatio = (idx + 0.5) / bars.length
							const filled = barRatio <= progress
							return (
								<span
									key={idx}
									style={{ height: `${Math.round(amp * 100)}%` }}
									className={`flex-1 rounded-full transition-colors duration-75 ${
										filled ? 'bg-[#cedb9c]' : 'bg-[#cedb9c]/28'
									}`}
								/>
							)
						})}
					</div>

					<div className="flex items-center justify-between text-[11px] text-[#b8b3a5] tabular-nums leading-none">
						<span>{formatDuration(currentTime)}</span>
						<span>{formatDuration(duration)}</span>
					</div>
				</div>
			</div>

			{/* Stepped Playback Speed Dial Bar */}
			<div className="grid grid-cols-4 gap-1 rounded-xl bg-black/25 p-1">
				{SPEED_STEPS.map((step) => {
					const active = rate === step
					return (
						<button
							key={step}
							type="button"
							onClick={(e) => selectRate(step, e)}
							className={`py-1 rounded-lg text-[11px] font-bold tabular-nums transition cursor-pointer ${
								active
									? 'bg-[#cedb9c] text-[#050a08]'
									: 'text-[#b8b3a5] hover:text-[#edf3d2]'
							}`}
						>
							{step}x
						</button>
					)
				})}
			</div>
		</div>
	)
}

export function ImageGroupCard({
	images,
	onOpenLightbox,
}: {
	images: { id: string; url: string; filename: string }[]
	onOpenLightbox: (url: string, filename: string) => void
}) {
	if (images.length === 0) return null

	if (images.length === 1) {
		const img = images[0]
		return (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onOpenLightbox(img.url, img.filename)
				}}
				className="block w-full rounded-[18px] overflow-hidden bg-black/25 shadow-lg shadow-black/35 cursor-pointer group"
			>
				<img
					src={img.url}
					alt={img.filename}
					loading="lazy"
					className="w-full max-h-[340px] object-cover transition-transform duration-200 group-hover:scale-[1.015]"
				/>
			</button>
		)
	}

	if (images.length === 2) {
		return (
			<div className="grid grid-cols-2 gap-1 rounded-[18px] overflow-hidden shadow-lg shadow-black/35 bg-black/25">
				{images.map((img) => (
					<button
						key={img.id}
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onOpenLightbox(img.url, img.filename)
						}}
						className="aspect-[4/5] overflow-hidden cursor-pointer group"
					>
						<img
							src={img.url}
							alt={img.filename}
							loading="lazy"
							className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
						/>
					</button>
				))}
			</div>
		)
	}

	if (images.length === 3) {
		return (
			<div className="grid grid-cols-2 gap-1 rounded-[18px] overflow-hidden shadow-lg shadow-black/35 bg-black/25">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						onOpenLightbox(images[0].url, images[0].filename)
					}}
					className="row-span-2 aspect-[3/4] overflow-hidden cursor-pointer group"
				>
					<img
						src={images[0].url}
						alt={images[0].filename}
						loading="lazy"
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				</button>
				{images.slice(1, 3).map((img) => (
					<button
						key={img.id}
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onOpenLightbox(img.url, img.filename)
						}}
						className="aspect-square overflow-hidden cursor-pointer group"
					>
						<img
							src={img.url}
							alt={img.filename}
							loading="lazy"
							className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
						/>
					</button>
				))}
			</div>
		)
	}

	const extra = images.length - 4
	return (
		<div className="grid grid-cols-2 gap-1 rounded-[18px] overflow-hidden shadow-lg shadow-black/35 bg-black/25">
			{images.slice(0, 4).map((img, i) => (
				<button
					key={img.id}
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						onOpenLightbox(img.url, img.filename)
					}}
					className="relative aspect-square overflow-hidden cursor-pointer group"
				>
					<img
						src={img.url}
						alt={img.filename}
						loading="lazy"
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
					{i === 3 && extra > 0 && (
						<div className="absolute inset-0 bg-black/55 flex items-center justify-center text-[22px] font-bold text-[#f2fbd0]">
							+{extra}
						</div>
					)}
				</button>
			))}
		</div>
	)
}

export function VideoMessageCard({ url }: { url: string; filename?: string }) {
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const [playing, setPlaying] = useState(false)
	const [muted, setMuted] = useState(false)
	const [duration, setDuration] = useState(0)
	const [currentTime, setCurrentTime] = useState(0)
	const [aspectRatio, setAspectRatio] = useState<number>(16 / 9)

	const togglePlay = (e: React.MouseEvent) => {
		e.stopPropagation()
		const el = videoRef.current
		if (!el) return
		if (el.paused) {
			void el.play().catch(() => {})
		} else {
			el.pause()
		}
	}

	const toggleMute = (e: React.MouseEvent) => {
		e.stopPropagation()
		const el = videoRef.current
		if (!el) return
		el.muted = !el.muted
		setMuted(el.muted)
	}

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0

	return (
		<div
			data-no-pane-swipe="true"
			onClick={togglePlay}
			style={{ aspectRatio: String(Math.max(0.65, Math.min(2.1, aspectRatio))) }}
			className="relative w-full max-w-[340px] max-h-[380px] rounded-[18px] overflow-hidden bg-black shadow-lg shadow-black/40 cursor-pointer group"
		>
			<video
				ref={videoRef}
				src={url}
				playsInline
				preload="metadata"
				onLoadedMetadata={(e) => {
					const v = e.currentTarget
					if (v.videoWidth && v.videoHeight) {
						setAspectRatio(v.videoWidth / v.videoHeight)
					}
					if (Number.isFinite(v.duration)) setDuration(v.duration)
				}}
				onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onEnded={() => {
					setPlaying(false)
					setCurrentTime(0)
				}}
				className="w-full h-full object-cover"
			/>

			{/* Centered Play Button Overlay */}
			{!playing && (
				<div className="absolute inset-0 bg-black/25 flex items-center justify-center transition group-hover:bg-black/35">
					<div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm text-[#f2fbd0] flex items-center justify-center shadow-xl transition-transform group-hover:scale-105">
						<svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
							<path d="M7 5.14v13.72a1 1 0 0 0 1.52.85l11.02-6.86a1 1 0 0 0 0-1.7L8.52 4.29A1 1 0 0 0 7 5.14z" />
						</svg>
					</div>
				</div>
			)}

			{/* Bottom Controls Overlay */}
			<div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-center justify-between gap-2">
				<span className="text-[11px] font-semibold text-[#f2fbd0]/90 tabular-nums px-2 py-0.5 rounded-full bg-black/45">
					{playing ? formatDuration(currentTime) : duration > 0 ? formatDuration(duration) : 'Video'}
				</span>
				{playing && (
					<button
						type="button"
						onClick={toggleMute}
						aria-label={muted ? 'Unmute video' : 'Mute video'}
						className="w-7 h-7 rounded-full bg-black/55 text-[#f2fbd0] flex items-center justify-center cursor-pointer"
					>
						{muted ? (
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
								<line x1="23" y1="9" x2="17" y2="15" />
								<line x1="17" y1="9" x2="23" y2="15" />
							</svg>
						) : (
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
							</svg>
						)}
					</button>
				)}
			</div>

			{/* Subtle bottom progress bar */}
			{duration > 0 && (
				<div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
					<div className="h-full bg-[#cedb9c] transition-[width] duration-150" style={{ width: `${progress}%` }} />
				</div>
			)}
		</div>
	)
}

export function DocumentMessageCard({
	asset,
	url,
}: {
	asset: FileAsset
	url?: string | null
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [renderedCover, setRenderedCover] = useState(false)
	const [pageAspect, setPageAspect] = useState<number>(0.74)
	const { ext, accent } = useMemo(
		() => getDocTypeLabel(asset.filename, asset.contentType),
		[asset.filename, asset.contentType]
	)
	const isPdf = ext === 'PDF'

	useEffect(() => {
		if (!isPdf || !url) return
		let cancelled = false

		void (async () => {
			try {
				const pdfjs = await import('pdfjs-dist')
				if (!pdfjs.GlobalWorkerOptions.workerSrc) {
					pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
				}
				const loadingTask = pdfjs.getDocument({ url, withCredentials: false })
				const pdf = await loadingTask.promise
				if (cancelled) return
				const page = await pdf.getPage(1)
				if (cancelled) return

				const baseViewport = page.getViewport({ scale: 1 })
				const ratio = baseViewport.width / baseViewport.height
				if (Number.isFinite(ratio) && ratio > 0.4 && ratio < 1.8) {
					setPageAspect(ratio)
				}

				const canvas = canvasRef.current
				if (!canvas) return
				const targetWidth = 420
				const scale = targetWidth / baseViewport.width
				const viewport = page.getViewport({ scale })
				canvas.width = viewport.width
				canvas.height = viewport.height

				const ctx = canvas.getContext('2d')
				if (!ctx) return
				await page.render({ canvasContext: ctx, viewport, canvas }).promise
				if (!cancelled) setRenderedCover(true)
			} catch {
				// Fallback to clean book-cover placeholder
			}
		})()

		return () => {
			cancelled = true
		}
	}, [isPdf, url])

	const sizeLabel = formatBytes(asset.sizeBytes)

	return (
		<a
			href={url || '#'}
			target={url ? '_blank' : undefined}
			rel={url ? 'noopener noreferrer' : undefined}
			onClick={(e) => {
				e.stopPropagation()
				if (!url) e.preventDefault()
			}}
			className="block w-[210px] sm:w-[232px] rounded-[18px] overflow-hidden bg-[#221d19] shadow-lg shadow-black/45 hover:brightness-105 transition group"
		>
			{/* Book Cover / First Page Area */}
			<div
				style={{ aspectRatio: String(pageAspect) }}
				className="relative w-full bg-[#2a241f] overflow-hidden flex items-center justify-center"
			>
				{isPdf && (
					<canvas
						ref={canvasRef}
						className={`w-full h-full object-cover transition-opacity duration-200 ${
							renderedCover ? 'opacity-100' : 'opacity-0 absolute inset-0'
						}`}
					/>
				)}

				{!renderedCover && (
					<div className="w-full h-full p-5 flex flex-col justify-between bg-gradient-to-br from-[#2d2722] to-[#1d1916]">
						<div className="space-y-2 opacity-40">
							<div className="h-2 w-2/3 rounded-full bg-[#e5ebcd]" />
							<div className="h-1.5 w-full rounded-full bg-[#e5ebcd]/70" />
							<div className="h-1.5 w-5/6 rounded-full bg-[#e5ebcd]/70" />
							<div className="h-1.5 w-4/5 rounded-full bg-[#e5ebcd]/50" />
						</div>
						<div className="space-y-1.5">
							<div className="text-[14px] font-semibold text-[#edf3d2] line-clamp-3 leading-snug">
								{asset.filename.replace(/\.[^.]+$/, '')}
							</div>
							{asset.previewText && (
								<div className="text-[11px] text-[#9e998c] line-clamp-2 leading-relaxed">
									{asset.previewText}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Bottom Document Type Bar */}
			<div className="px-3 py-2.5 bg-[#1b1714] flex items-center gap-2.5">
				<div
					style={{ color: accent }}
					className="w-8 h-8 rounded-xl bg-[#2a241f] flex items-center justify-center shrink-0"
				>
					<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="8" y1="13" x2="16" y2="13" />
						<line x1="8" y1="17" x2="13" y2="17" />
					</svg>
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-[13px] font-semibold text-[#edf3d2] truncate">
						{asset.filename}
					</div>
					<div className="text-[11px] text-[#9e998c] truncate">
						{ext}{sizeLabel ? ` · ${sizeLabel}` : ''}
					</div>
				</div>
			</div>
		</a>
	)
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/i

export function extractFirstUrl(text: string): string | null {
	if (!text) return null
	const m = text.match(URL_REGEX)
	if (!m) return null
	return m[1].replace(/[.,!?;:)\]]+$/, '')
}

export function LinkPreviewCard({ url }: { url: string }) {
	let host = url
	let pathLabel = ''
	try {
		const parsed = new URL(url)
		host = parsed.hostname.replace(/^www\./, '')
		const cleanPath = parsed.pathname.replace(/\/$/, '')
		pathLabel = cleanPath && cleanPath !== '/' ? decodeURIComponent(cleanPath) : parsed.href
	} catch {
		// keep raw
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(e) => e.stopPropagation()}
			className="mt-2 flex items-center gap-3 rounded-[14px] bg-black/25 hover:bg-black/35 px-3 py-2.5 transition group"
		>
			<div className="w-9 h-9 rounded-xl bg-[#2a241f] text-[#cedb9c] flex items-center justify-center shrink-0">
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
			</div>
			<div className="min-w-0 flex-1">
				<div className="text-[13px] font-semibold text-[#edf3d2] truncate">{host}</div>
				<div className="text-[12px] text-[#9e998c] truncate">{pathLabel}</div>
			</div>
			<svg
				className="w-4 h-4 text-[#9e998c] group-hover:text-[#cedb9c] shrink-0 transition"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<polyline points="15 3 21 3 21 9" />
				<line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</a>
	)
}
