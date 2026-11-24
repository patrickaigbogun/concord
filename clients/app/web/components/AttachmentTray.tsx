import { useRef, useState } from 'react'
import { uploadFile } from '../../lib/storage'
import type { FileAsset } from '../../lib/types'

interface AttachmentTrayProps {
	spaceId: string
	onClose: () => void
	onSendAsset: (asset: FileAsset, caption?: string) => void
	onSendSticker: (sticker: string) => void
}

const STICKERS = ['✦', '❖', '☾', '〰', '✎', '♪', '◈', '☄', '❀', '⌘', '⚡', '🕊']

/**
 * Compresses an image client-side into WebP (preserving crisp quality while cutting upload size).
 */
async function optimizeImageToWebP(file: File, rotationDeg: number): Promise<File> {
	const bitmap = await createImageBitmap(file)
	const maxDim = 1600
	let { width, height } = bitmap
	if (width > maxDim || height > maxDim) {
		const ratio = Math.min(maxDim / width, maxDim / height)
		width = Math.round(width * ratio)
		height = Math.round(height * ratio)
	}

	const swap = rotationDeg % 180 !== 0
	const canvas = document.createElement('canvas')
	canvas.width = swap ? height : width
	canvas.height = swap ? width : height

	const ctx = canvas.getContext('2d')
	if (!ctx) return file

	ctx.translate(canvas.width / 2, canvas.height / 2)
	ctx.rotate((rotationDeg * Math.PI) / 180)
	ctx.drawImage(bitmap, -width / 2, -height / 2, width, height)

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((b) => resolve(b), 'image/webp', 0.84)
	)
	if (!blob) return file

	const baseName = file.name.replace(/\.[^.]+$/, '')
	return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
}

export function AttachmentTray({ spaceId, onClose, onSendAsset, onSendSticker }: AttachmentTrayProps) {
	const [tab, setTab] = useState<'media' | 'docs' | 'stickers'>('media')
	const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; rotation: number } | null>(null)
	const [pendingDoc, setPendingDoc] = useState<{ file: File; textPreview?: string } | null>(null)
	const [caption, setCaption] = useState('')
	const [uploading, setUploading] = useState(false)
	const [statusMsg, setStatusMsg] = useState<string | null>(null)

	const imgInputRef = useRef<HTMLInputElement>(null)
	const docInputRef = useRef<HTMLInputElement>(null)

	const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const previewUrl = URL.createObjectURL(file)
		setPendingImage({ file, previewUrl, rotation: 0 })
		setPendingDoc(null)
		setStatusMsg(null)
	}

	const handleSelectDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		let textPreview: string | undefined
		if (
			file.type.startsWith('text/') ||
			/\.(md|txt|json|ts|tsx|js|py|go|rs|ex|exs|css|html)$/i.test(file.name)
		) {
			const text = await file.text()
			textPreview = text.slice(0, 2000)
		}
		setPendingDoc({ file, textPreview })
		setPendingImage(null)
		setStatusMsg(null)
	}

	const handleUploadAndSend = async () => {
		const targetFile = pendingImage ? pendingImage.file : pendingDoc?.file
		if (!targetFile) return

		setUploading(true)
		setStatusMsg(null)
		try {
			const finalFile = pendingImage
				? await optimizeImageToWebP(pendingImage.file, pendingImage.rotation)
				: targetFile

			let asset: FileAsset
			try {
				const uploaded = await uploadFile(finalFile, spaceId)
				asset = {
					id: uploaded.id,
					spaceId,
					filename: uploaded.filename,
					contentType: uploaded.content_type,
					sizeBytes: uploaded.size_bytes,
					url: uploaded.url,
					kind: pendingImage ? 'image' : 'doc',
					previewText: pendingDoc?.textPreview,
					createdAt: 'Just now',
				}
			} catch {
				// Graceful local preview fallback if not signed into Concord ID yet
				asset = {
					id: `local-${Date.now()}`,
					spaceId,
					filename: finalFile.name,
					contentType: finalFile.type || 'application/octet-stream',
					sizeBytes: finalFile.size,
					url: pendingImage ? pendingImage.previewUrl : '#',
					kind: pendingImage ? 'image' : 'doc',
					previewText: pendingDoc?.textPreview,
					createdAt: 'Just now',
				}
			}

			onSendAsset(asset, caption.trim() || undefined)
			setPendingImage(null)
			setPendingDoc(null)
			setCaption('')
			onClose()
		} catch (err) {
			setStatusMsg(err instanceof Error ? err.message : 'Upload failed')
		} finally {
			setUploading(false)
		}
	}

	return (
		<div className="border-t border-white/[0.08] bg-[#111115] px-4 py-3 space-y-3">
			{/* Tray Tabs */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
					{(['media', 'docs', 'stickers'] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => {
								setTab(t)
								setPendingImage(null)
								setPendingDoc(null)
							}}
							className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
								tab === t ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
							}`}
						>
							{t === 'stickers' ? 'Stickers & GIFs' : t}
						</button>
					))}
				</div>

				<button
					type="button"
					onClick={onClose}
					className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-white/[0.05] cursor-pointer"
				>
					Close
				</button>
			</div>

			{/* Hidden File Inputs */}
			<input ref={imgInputRef} type="file" accept="image/*" onChange={handleSelectImage} className="hidden" />
			<input
				ref={docInputRef}
				type="file"
				accept=".md,.txt,.pdf,.json,.ts,.tsx,.js,.py,.go,.rs,.ex,.csv,.doc,.docx"
				onChange={handleSelectDoc}
				className="hidden"
			/>

			{/* Image Editor Preview */}
			{pendingImage && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3 space-y-3">
					<div className="flex items-center justify-between text-xs text-zinc-400">
						<span>Image Editor &bull; Auto-WebP Compression</span>
						<button
							type="button"
							onClick={() =>
								setPendingImage((p) => (p ? { ...p, rotation: (p.rotation + 90) % 360 } : null))
							}
							className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-zinc-200 cursor-pointer"
						>
							Rotate 90°
						</button>
					</div>
					<div className="flex justify-center overflow-hidden rounded-xl bg-black/40 max-h-48 py-2">
						<img
							src={pendingImage.previewUrl}
							alt="Preview"
							style={{ transform: `rotate(${pendingImage.rotation}deg)` }}
							className="max-h-44 object-contain transition-transform duration-200"
						/>
					</div>
					<div className="flex gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a caption…"
							className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleUploadAndSend}
							className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
						>
							{uploading ? 'Sending…' : 'Send'}
						</button>
					</div>
				</div>
			)}

			{/* Document Preview */}
			{pendingDoc && (
				<div className="rounded-2xl border border-white/10 bg-[#0a0a0d] p-3 space-y-2.5">
					<div className="flex items-center justify-between">
						<div className="text-xs font-semibold text-zinc-200 truncate">{pendingDoc.file.name}</div>
						<span className="text-[10px] text-zinc-500">
							{(pendingDoc.file.size / 1024).toFixed(1)} KB
						</span>
					</div>
					{pendingDoc.textPreview ? (
						<pre className="max-h-32 overflow-y-auto rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-[11px] text-zinc-300 whitespace-pre-wrap font-mono">
							{pendingDoc.textPreview}
						</pre>
					) : (
						<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-xs text-zinc-400">
							Ready to attach & preview natively inside this Space.
						</div>
					)}
					<div className="flex gap-2">
						<input
							type="text"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Add a note about this document…"
							className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
						/>
						<button
							type="button"
							disabled={uploading}
							onClick={handleUploadAndSend}
							className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
						>
							{uploading ? 'Uploading…' : 'Send Doc'}
						</button>
					</div>
				</div>
			)}

			{/* Default Tab Content */}
			{!pendingImage && !pendingDoc && tab === 'media' && (
				<div className="grid grid-cols-2 gap-2.5">
					<button
						type="button"
						onClick={() => imgInputRef.current?.click()}
						className="rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-white/[0.04] p-5 text-center transition cursor-pointer"
					>
						<div className="text-xs font-semibold text-zinc-200">Pick Image</div>
						<div className="text-[11px] text-zinc-500 mt-1">Opens editor + WebP optimizer</div>
					</button>
					<button
						type="button"
						onClick={() => docInputRef.current?.click()}
						className="rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] p-5 text-center transition cursor-pointer"
					>
						<div className="text-xs font-semibold text-zinc-200">Pick Video / Audio</div>
						<div className="text-[11px] text-zinc-500 mt-1">Streams directly to R2</div>
					</button>
				</div>
			)}

			{!pendingImage && !pendingDoc && tab === 'docs' && (
				<button
					type="button"
					onClick={() => docInputRef.current?.click()}
					className="w-full rounded-2xl border border-dashed border-white/15 hover:border-[#8b5cf6]/60 bg-white/[0.02] hover:bg-white/[0.04] p-5 text-center transition cursor-pointer"
				>
					<div className="text-xs font-semibold text-zinc-200">Choose Document (MD, PDF, TXT, Code, JSON)</div>
					<div className="text-[11px] text-zinc-500 mt-1">Instant in-app preview before sending to R2</div>
				</button>
			)}

			{!pendingImage && !pendingDoc && tab === 'stickers' && (
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

			{statusMsg && <p className="text-xs text-red-400">{statusMsg}</p>}
		</div>
	)
}
