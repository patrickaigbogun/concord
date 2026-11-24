import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { getSession } from '../../lib/auth'
import { searchSongs, type MusicTrack } from '../../lib/music'
import { uploadFile } from '../../lib/storage'
import type { RealmNote } from '../../lib/types'

export type RealmNoteDraft = RealmNote & {
	audioArtworkUrl?: string
	audioExternalUrl?: string
}

interface RealmNoteModalProps {
	currentNote?: RealmNoteDraft
	curatorName: string
	onSave: (note: RealmNoteDraft) => void
	onClose: () => void
}

interface SelectedAudio {
	title: string
	artist?: string
	url: string
	artworkUrl?: string
	externalUrl?: string
	source: 'itunes' | 'upload' | 'local'
}

type AudioTab = 'search' | 'upload'

const ACCEPTED_AUDIO_EXTENSIONS = '.mp3,.m4a,.wav,.ogg,.webm'
const MAX_NOTE_LENGTH = 180

function CloseIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M4 4l8 8M12 4l-8 8" />
		</svg>
	)
}

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
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
			<circle cx="7.25" cy="7.25" r="4.75" />
			<path d="M10.75 10.75L14 14" />
		</svg>
	)
}

function PlayIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
			<path d="M4.25 3.1a.75.75 0 0 1 1.13-.65l7.5 4.4a.75.75 0 0 1 0 1.3l-7.5 4.4A.75.75 0 0 1 4.25 11.9V3.1Z" />
		</svg>
	)
}

function PauseIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
			<rect x="3.5" y="2.75" width="3.25" height="10.5" rx="0.9" />
			<rect x="9.25" y="2.75" width="3.25" height="10.5" rx="0.9" />
		</svg>
	)
}

function MusicNoteIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

function UploadIcon({ className = 'w-5 h-5' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M10 13.5V4.5" />
			<path d="M6.5 8L10 4.5L13.5 8" />
			<path d="M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1" />
		</svg>
	)
}

function CheckIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M3.5 8.5l3 3 6-6.5" />
		</svg>
	)
}

function TrashIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
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
			<path d="M2.75 4.5h10.5M6 4.5V3.25A.75.75 0 0 1 6.75 2.5h2.5a.75.75 0 0 1 .75.75V4.5M4.5 4.5l.65 8.1a1 1 0 0 0 1 .9h3.7a1 1 0 0 0 1-.9l.65-8.1" />
		</svg>
	)
}

function formatDuration(sec?: number): string {
	if (!sec || !Number.isFinite(sec)) return ''
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}

function stripExtension(filename: string): string {
	return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || filename
}

export function RealmNoteModal({
	currentNote,
	curatorName,
	onSave,
	onClose,
}: RealmNoteModalProps) {
	const [text, setText] = useState(currentNote?.text ?? '')
	const [activeTab, setActiveTab] = useState<AudioTab>('search')
	const [selectedAudio, setSelectedAudio] = useState<SelectedAudio | null>(() => {
		if (!currentNote?.audioUrl && !currentNote?.audioTitle) return null
		return {
			title: currentNote.audioTitle || 'Audio',
			artist: currentNote.audioArtist,
			url: currentNote.audioUrl || '',
			artworkUrl: currentNote.audioArtworkUrl,
			externalUrl: currentNote.audioExternalUrl,
			source: currentNote.audioArtworkUrl ? 'itunes' : 'upload',
		}
	})

	// Search state
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<MusicTrack[]>([])
	const [searching, setSearching] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)

	// Upload state
	const [uploading, setUploading] = useState(false)
	const [uploadNotice, setUploadNotice] = useState<string | null>(null)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const [dragOver, setDragOver] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Shared preview audio player
	const previewAudioRef = useRef<HTMLAudioElement>(null)
	const [previewUrlPlaying, setPreviewUrlPlaying] = useState<string | null>(null)

	const stopPreview = () => {
		const el = previewAudioRef.current
		if (el) {
			el.pause()
			el.currentTime = 0
		}
		setPreviewUrlPlaying(null)
	}

	const togglePreview = (url: string) => {
		if (!url) return
		const el = previewAudioRef.current
		if (!el) return

		if (previewUrlPlaying === url) {
			el.pause()
			setPreviewUrlPlaying(null)
			return
		}

		el.pause()
		el.src = url
		el.currentTime = 0
		el.play()
			.then(() => {
				setPreviewUrlPlaying(url)
			})
			.catch(() => {
				setPreviewUrlPlaying(null)
			})
	}

	useEffect(() => {
		const el = previewAudioRef.current
		if (!el) return
		const onEnded = () => setPreviewUrlPlaying(null)
		const onError = () => setPreviewUrlPlaying(null)
		el.addEventListener('ended', onEnded)
		el.addEventListener('error', onError)
		return () => {
			el.removeEventListener('ended', onEnded)
			el.removeEventListener('error', onError)
			el.pause()
		}
	}, [])

	// Close on Escape
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				stopPreview()
				onClose()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	// Debounced iTunes search
	useEffect(() => {
		const trimmed = query.trim()
		if (!trimmed) {
			setResults([])
			setSearching(false)
			setHasSearched(false)
			return
		}

		const controller = new AbortController()
		setSearching(true)

		const timer = window.setTimeout(async () => {
			const tracks = await searchSongs(trimmed, controller.signal)
			if (!controller.signal.aborted) {
				setResults(tracks)
				setSearching(false)
				setHasSearched(true)
			}
		}, 300)

		return () => {
			window.clearTimeout(timer)
			controller.abort()
		}
	}, [query])

	const handleSelectTrack = (track: MusicTrack) => {
		setSelectedAudio({
			title: track.title,
			artist: track.artist,
			url: track.previewUrl,
			artworkUrl: track.artworkUrl,
			externalUrl: track.externalUrl,
			source: 'itunes',
		})
		setUploadNotice(null)
		setUploadError(null)
	}

	const handleAudioFile = async (file: File) => {
		const isAudio =
			file.type.startsWith('audio/') ||
			/\.(mp3|m4a|wav|ogg|webm)$/i.test(file.name)

		if (!isAudio) {
			setUploadError('Please select an audio file (.mp3, .m4a, .wav, .ogg, or .webm).')
			return
		}

		setUploadError(null)
		setUploadNotice(null)
		setUploading(true)
		stopPreview()

		const cleanTitle = stripExtension(file.name)

		try {
			const asset = await uploadFile(file)
			setSelectedAudio({
				title: cleanTitle,
				artist: curatorName,
				url: asset.url,
				source: 'upload',
			})
			setUploadNotice('Uploaded to Realm storage.')
		} catch (err) {
			if (getSession()?.access_token) {
				setUploadError(err instanceof Error ? err.message : 'Audio upload to Concord R2 failed.')
			} else {
				const localUrl = URL.createObjectURL(file)
				setSelectedAudio({
					title: cleanTitle,
					artist: curatorName,
					url: localUrl,
					source: 'local',
				})
				setUploadNotice('Sign in to persist audio to cloud storage. Using local session preview for now.')
			}
		} finally {
			setUploading(false)
		}
	}

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			void handleAudioFile(file)
		}
		e.target.value = ''
	}

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		setDragOver(false)
		const file = e.dataTransfer.files?.[0]
		if (file) {
			void handleAudioFile(file)
		}
	}

	const handleClearAudio = () => {
		stopPreview()
		setSelectedAudio(null)
		setUploadNotice(null)
		setUploadError(null)
	}

	const handleSave = () => {
		const trimmedText = text.trim()
		if (!trimmedText) return

		stopPreview()

		const nextNote: RealmNoteDraft = {
			text: trimmedText,
			curatorName,
			updatedAt: 'just now',
		}

		if (selectedAudio && (selectedAudio.url || selectedAudio.title)) {
			nextNote.audioTitle = selectedAudio.title.trim() || 'Audio'
			if (selectedAudio.artist?.trim()) {
				nextNote.audioArtist = selectedAudio.artist.trim()
			}
			if (selectedAudio.url) {
				nextNote.audioUrl = selectedAudio.url
			}
			if (selectedAudio.artworkUrl) {
				nextNote.audioArtworkUrl = selectedAudio.artworkUrl
			}
			if (selectedAudio.externalUrl) {
				nextNote.audioExternalUrl = selectedAudio.externalUrl
			}
		}

		onSave(nextNote)
	}

	return (
		<div
			className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					stopPreview()
					onClose()
				}
			}}
		>
			<audio ref={previewAudioRef} preload="none" />

			<div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#101014] border border-white/10 shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
					<div>
						<div className="text-[10px] uppercase tracking-widest text-[#c4b5fd] font-semibold">
							Curator Note
						</div>
						<h2 className="text-base font-bold text-white tracking-tight mt-0.5">
							Set Realm Note &amp; Music
						</h2>
					</div>
					<button
						type="button"
						onClick={() => {
							stopPreview()
							onClose()
						}}
						aria-label="Close modal"
						className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>

				{/* Body */}
				<div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
					{/* Note text */}
					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label
								htmlFor="realm-note-text"
								className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400"
							>
								Realm Note
							</label>
							<span className="text-[10px] text-zinc-500">
								{text.length}/{MAX_NOTE_LENGTH}
							</span>
						</div>
						<textarea
							id="realm-note-text"
							rows={2}
							maxLength={MAX_NOTE_LENGTH}
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="Leave a quiet editorial note for everyone in this Realm..."
							className="w-full rounded-2xl bg-[#15151b] border border-white/[0.08] focus:border-[#8b5cf6]/60 focus:outline-none px-3.5 py-2.5 text-sm font-editorial italic text-zinc-100 placeholder:text-zinc-500 resize-none transition"
						/>
					</div>

					{/* Attached audio summary */}
					{selectedAudio && (
						<div className="rounded-2xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 px-3.5 py-2.5 flex items-center justify-between gap-3">
							<div className="flex items-center gap-3 min-w-0">
								{selectedAudio.artworkUrl ? (
									<img
										src={selectedAudio.artworkUrl}
										alt=""
										className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10"
									/>
								) : (
									<div className="w-9 h-9 rounded-lg bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 flex items-center justify-center shrink-0 text-[#c4b5fd]">
										<MusicNoteIcon className="w-4 h-4" />
									</div>
								)}
								<div className="min-w-0">
									<div className="text-xs font-semibold text-white truncate">
										{selectedAudio.title}
									</div>
									<div className="text-[11px] text-zinc-400 truncate">
										{selectedAudio.artist || 'Attached audio'}
										{selectedAudio.source === 'local' ? ' · Local preview' : ''}
									</div>
								</div>
							</div>

							<div className="shrink-0 flex items-center gap-1.5">
								{selectedAudio.url && (
									<button
										type="button"
										onClick={() => togglePreview(selectedAudio.url)}
										aria-label={
											previewUrlPlaying === selectedAudio.url
												? 'Pause selected audio'
												: 'Preview selected audio'
										}
										className="p-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white transition cursor-pointer"
									>
										{previewUrlPlaying === selectedAudio.url ? (
											<PauseIcon className="w-3.5 h-3.5" />
										) : (
											<PlayIcon className="w-3.5 h-3.5" />
										)}
									</button>
								)}
								<button
									type="button"
									onClick={handleClearAudio}
									title="Remove audio"
									aria-label="Remove audio"
									className="p-2 rounded-full bg-white/[0.05] hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition cursor-pointer"
								>
									<TrashIcon className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>
					)}

					{/* Tabs */}
					<div className="space-y-3">
						<div className="grid grid-cols-2 p-1 rounded-xl bg-[#15151b] border border-white/[0.07]">
							<button
								type="button"
								onClick={() => setActiveTab('search')}
								className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
									activeTab === 'search'
										? 'bg-[#8b5cf6]/25 text-white border border-[#8b5cf6]/40'
										: 'text-zinc-400 hover:text-zinc-200 border border-transparent'
								}`}
							>
								Search Song
							</button>
							<button
								type="button"
								onClick={() => setActiveTab('upload')}
								className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
									activeTab === 'upload'
										? 'bg-[#8b5cf6]/25 text-white border border-[#8b5cf6]/40'
										: 'text-zinc-400 hover:text-zinc-200 border border-transparent'
								}`}
							>
								Upload Audio
							</button>
						</div>

						{activeTab === 'search' ? (
							<div className="space-y-3">
								{/* Search input */}
								<div className="relative">
									<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
										<SearchIcon className="w-4 h-4" />
									</span>
									<input
										type="text"
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder="Search songs, artists, or albums..."
										className="w-full rounded-xl bg-[#15151b] border border-white/[0.08] focus:border-[#8b5cf6]/60 focus:outline-none pl-10 pr-9 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 transition"
									/>
									{query && (
										<button
											type="button"
											onClick={() => setQuery('')}
											aria-label="Clear search"
											className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
										>
											<CloseIcon className="w-3.5 h-3.5" />
										</button>
									)}
								</div>

								{/* Results list */}
								<div className="max-h-60 overflow-y-auto no-scrollbar space-y-1.5">
									{searching && (
										<div className="py-8 text-center text-xs text-zinc-400">
											Searching tracks...
										</div>
									)}

									{!searching && !query.trim() && (
										<div className="py-8 text-center text-xs text-zinc-500">
											Type a song or artist to attach a 30-second soundtrack preview.
										</div>
									)}

									{!searching && hasSearched && results.length === 0 && (
										<div className="py-8 text-center text-xs text-zinc-500">
											No playable previews found for “{query.trim()}”.
										</div>
									)}

									{!searching &&
										results.map((track) => {
											const isPlaying = previewUrlPlaying === track.previewUrl
											const isSelected = selectedAudio?.url === track.previewUrl

											return (
												<div
													key={track.id}
													className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border transition ${
														isSelected
															? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40'
															: 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.14]'
													}`}
												>
													<div className="flex items-center gap-2.5 min-w-0">
														<button
															type="button"
															onClick={() => togglePreview(track.previewUrl)}
															aria-label={isPlaying ? `Pause ${track.title}` : `Preview ${track.title}`}
															className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/[0.06] border border-white/10 group cursor-pointer"
														>
															{track.artworkUrl ? (
																<img
																	src={track.artworkUrl}
																	alt=""
																	className="w-full h-full object-cover"
																/>
															) : (
																<span className="w-full h-full flex items-center justify-center text-zinc-400">
																	<MusicNoteIcon className="w-4 h-4" />
																</span>
															)}
															<span
																className={`absolute inset-0 flex items-center justify-center bg-black/55 text-white transition ${
																	isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
																}`}
															>
																{isPlaying ? (
																	<PauseIcon className="w-3.5 h-3.5" />
																) : (
																	<PlayIcon className="w-3.5 h-3.5" />
																)}
															</span>
														</button>

														<div className="min-w-0">
															<div className="text-xs font-semibold text-zinc-100 truncate">
																{track.title}
															</div>
															<div className="text-[11px] text-zinc-400 truncate">
																{track.artist}
																{track.durationSec ? ` · ${formatDuration(track.durationSec)}` : ''}
															</div>
														</div>
													</div>

													<div className="shrink-0 flex items-center gap-1.5">
														<button
															type="button"
															onClick={() => togglePreview(track.previewUrl)}
															aria-label={isPlaying ? 'Pause preview' : 'Play 30s preview'}
															className={`p-1.5 rounded-full border transition cursor-pointer ${
																isPlaying
																	? 'bg-[#8b5cf6]/25 border-[#8b5cf6]/50 text-[#c4b5fd]'
																	: 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white'
															}`}
														>
															{isPlaying ? (
																<PauseIcon className="w-3 h-3" />
															) : (
																<PlayIcon className="w-3 h-3" />
															)}
														</button>
														<button
															type="button"
															onClick={() => handleSelectTrack(track)}
															className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
																isSelected
																	? 'bg-[#8b5cf6] text-white'
																	: 'bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200'
															}`}
														>
															{isSelected && <CheckIcon className="w-3 h-3" />}
															<span>{isSelected ? 'Selected' : 'Select'}</span>
														</button>
													</div>
												</div>
											)
										})}
								</div>
							</div>
						) : (
							<div className="space-y-3">
								<input
									ref={fileInputRef}
									type="file"
									accept={`${ACCEPTED_AUDIO_EXTENSIONS},audio/*`}
									onChange={handleFileChange}
									className="hidden"
								/>

								<div
									onDragOver={(e) => {
										e.preventDefault()
										setDragOver(true)
									}}
									onDragLeave={() => setDragOver(false)}
									onDrop={handleDrop}
									onClick={() => !uploading && fileInputRef.current?.click()}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
											e.preventDefault()
											fileInputRef.current?.click()
										}
									}}
									className={`rounded-2xl border border-dashed p-6 text-center transition cursor-pointer ${
										dragOver
											? 'border-[#8b5cf6] bg-[#8b5cf6]/10'
											: 'border-white/15 bg-[#15151b]/70 hover:border-white/25 hover:bg-[#15151b]'
									}`}
								>
									<div className="w-10 h-10 mx-auto rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-2.5">
										<UploadIcon className="w-5 h-5" />
									</div>
									<div className="text-xs font-semibold text-zinc-200">
										{uploading ? 'Uploading audio...' : 'Click or drop an audio file'}
									</div>
									<div className="text-[11px] text-zinc-500 mt-1">
										MP3, M4A, WAV, OGG, or WEBM
									</div>
								</div>

								{selectedAudio && (selectedAudio.source === 'upload' || selectedAudio.source === 'local') && (
									<div className="grid grid-cols-2 gap-2.5">
										<div>
											<label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
												Track Title
											</label>
											<input
												type="text"
												value={selectedAudio.title}
												onChange={(e) =>
													setSelectedAudio((prev) =>
														prev ? { ...prev, title: e.target.value } : prev
													)
												}
												className="w-full rounded-xl bg-[#15151b] border border-white/[0.08] focus:border-[#8b5cf6]/60 focus:outline-none px-3 py-1.5 text-xs text-zinc-100"
											/>
										</div>
										<div>
											<label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
												Artist / Credit
											</label>
											<input
												type="text"
												value={selectedAudio.artist || ''}
												onChange={(e) =>
													setSelectedAudio((prev) =>
														prev ? { ...prev, artist: e.target.value } : prev
													)
												}
												className="w-full rounded-xl bg-[#15151b] border border-white/[0.08] focus:border-[#8b5cf6]/60 focus:outline-none px-3 py-1.5 text-xs text-zinc-100"
											/>
										</div>
									</div>
								)}

								{uploadNotice && (
									<p className="text-[11px] text-[#c4b5fd] bg-[#8b5cf6]/10 border border-[#8b5cf6]/25 rounded-xl px-3 py-2">
										{uploadNotice}
									</p>
								)}

								{uploadError && (
									<p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
										{uploadError}
									</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="px-5 py-3.5 border-t border-white/[0.07] bg-[#0d0d11] flex items-center justify-between gap-3 shrink-0">
					<div>
						{selectedAudio ? (
							<button
								type="button"
								onClick={handleClearAudio}
								className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
							>
								Clear Audio
							</button>
						) : (
							<span className="text-[11px] text-zinc-500">By {curatorName}</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								stopPreview()
								onClose()
							}}
							className="px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-300 transition cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={!text.trim() || uploading}
							onClick={handleSave}
							className="px-4 py-1.5 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition cursor-pointer"
						>
							Save Note
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
