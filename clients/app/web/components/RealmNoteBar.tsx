import { useEffect, useRef, useState } from 'react'
import { safeHttpsUrl, safeMediaUrl } from '../../lib/url'
import type { RealmNote } from '../../lib/types'

export type RealmNoteWithArtwork = RealmNote & {
	audioArtworkUrl?: string
	audioExternalUrl?: string
}

interface RealmNoteBarProps {
	note?: RealmNoteWithArtwork
	onEditNote?: () => void
}

function PlayIcon({ className = 'w-3 h-3' }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
			<path d="M4.25 3.1a.75.75 0 0 1 1.13-.65l7.5 4.4a.75.75 0 0 1 0 1.3l-7.5 4.4A.75.75 0 0 1 4.25 11.9V3.1Z" />
		</svg>
	)
}

function PauseIcon({ className = 'w-3 h-3' }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
			<rect x="3.5" y="2.75" width="3.25" height="10.5" rx="0.9" />
			<rect x="9.25" y="2.75" width="3.25" height="10.5" rx="0.9" />
		</svg>
	)
}

function MusicNoteIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M6.5 12.25V4.25l6-1.5v8" />
			<circle cx="4.75" cy="12.25" r="1.75" />
			<circle cx="10.75" cy="10.75" r="1.75" />
		</svg>
	)
}

function EditIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M11.33 2.67a1.5 1.5 0 0 1 2.12 2.12L5.5 12.74l-2.75.63.63-2.75 7.95-7.95Z" />
		</svg>
	)
}

export function RealmNoteBar({ note, onEditNote }: RealmNoteBarProps) {
	const audioRef = useRef<HTMLAudioElement>(null)
	const [playing, setPlaying] = useState(false)
	const [progress, setProgress] = useState(0)

	const audioUrl = safeMediaUrl(note?.audioUrl)
	const artworkUrl = safeHttpsUrl(note?.audioArtworkUrl)

	useEffect(() => {
		const el = audioRef.current
		if (el) {
			el.pause()
			el.currentTime = 0
		}
		setPlaying(false)
		setProgress(0)
	}, [audioUrl])

	useEffect(() => {
		const el = audioRef.current
		if (!el) return

		const handlePlay = () => setPlaying(true)
		const handlePause = () => setPlaying(false)
		const handleEnded = () => {
			setPlaying(false)
			setProgress(0)
		}
		const handleTimeUpdate = () => {
			if (el.duration && Number.isFinite(el.duration) && el.duration > 0) {
				setProgress(Math.min(1, Math.max(0, el.currentTime / el.duration)))
			}
		}
		const handleError = () => {
			setPlaying(false)
			setProgress(0)
		}

		el.addEventListener('play', handlePlay)
		el.addEventListener('pause', handlePause)
		el.addEventListener('ended', handleEnded)
		el.addEventListener('timeupdate', handleTimeUpdate)
		el.addEventListener('error', handleError)

		return () => {
			el.removeEventListener('play', handlePlay)
			el.removeEventListener('pause', handlePause)
			el.removeEventListener('ended', handleEnded)
			el.removeEventListener('timeupdate', handleTimeUpdate)
			el.removeEventListener('error', handleError)
		}
	}, [audioUrl])

	const togglePlay = () => {
		const el = audioRef.current
		if (!el || !audioUrl) return

		if (playing) {
			el.pause()
		} else {
			el.play().catch(() => {
				setPlaying(false)
			})
		}
	}

	if (!note) {
		if (!onEditNote) return null
		return (
			<div className="px-4 py-1.5 bg-[#111116]/90 border-b border-white/[0.06] flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 min-w-0">
					<span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
						Note
					</span>
					<span className="text-xs text-zinc-500 truncate font-editorial italic">
						No Realm Note set yet
					</span>
				</div>
				<button
					type="button"
					onClick={onEditNote}
					className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-[11px] font-medium text-zinc-300 hover:text-white transition cursor-pointer"
				>
					<EditIcon className="w-3 h-3" />
					<span>Set Note</span>
				</button>
			</div>
		)
	}

	const hasAudioTrack = Boolean(note.audioTitle || audioUrl)
	const canPlayAudio = Boolean(audioUrl)

	return (
		<div className="relative px-4 py-1.5 bg-[#111116]/90 border-b border-white/[0.06] flex items-center justify-between gap-3">
			{audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

			<div className="flex items-center gap-2.5 min-w-0">
				<span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-[#a78bfa] bg-[#8b5cf6]/15 px-2 py-0.5 rounded-full">
					Note
				</span>
				<p className="text-xs text-zinc-300 truncate font-editorial italic">
					“{note.text}”
				</p>
			</div>

			<div className="shrink-0 flex items-center gap-2">
				{hasAudioTrack ? (
					<button
						type="button"
						onClick={togglePlay}
						disabled={!canPlayAudio}
						title={
							note.audioArtist
								? `${note.audioTitle || 'Audio'} — ${note.audioArtist}`
								: note.audioTitle || 'Realm audio'
						}
						aria-label={playing ? 'Pause realm audio' : 'Play realm audio'}
						className={`shrink-0 flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
							!canPlayAudio
								? 'bg-white/[0.03] border-white/[0.06] text-zinc-500 cursor-default'
								: playing
									? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 text-[#c4b5fd] cursor-pointer'
									: 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/15 cursor-pointer'
						}`}
					>
						{artworkUrl ? (
							<img
								src={artworkUrl}
								alt=""
								className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/10"
							/>
						) : (
							<span className="w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-zinc-400">
								<MusicNoteIcon className="w-2.5 h-2.5" />
							</span>
						)}
						{canPlayAudio && (
							<span className="shrink-0 flex items-center justify-center">
								{playing ? <PauseIcon className="w-2.5 h-2.5" /> : <PlayIcon className="w-2.5 h-2.5" />}
							</span>
						)}
						<span className="max-w-[130px] truncate">{note.audioTitle || 'Audio'}</span>
					</button>
				) : (
					<span className="shrink-0 text-[10px] text-zinc-500">{note.updatedAt}</span>
				)}

				{onEditNote && (
					<button
						type="button"
						onClick={onEditNote}
						title="Edit Realm Note"
						aria-label="Edit Realm Note"
						className="shrink-0 p-1.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
					>
						<EditIcon className="w-3.5 h-3.5" />
					</button>
				)}
			</div>

			{(playing || progress > 0) && (
				<div
					className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] bg-white/[0.04] overflow-hidden"
					aria-hidden="true"
				>
					<div
						className="h-full bg-[#8b5cf6]/80 transition-[width] duration-150 ease-linear"
						style={{ width: `${Math.round(progress * 100)}%` }}
					/>
				</div>
			)}
		</div>
	)
}
