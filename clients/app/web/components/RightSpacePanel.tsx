import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { safeHttpsUrl, safeMediaUrl, safeStorageUrl } from '../../lib/url'
import type { FileAsset, Space } from '../../lib/types'

interface RightSpacePanelProps {
	space: Space
	files: FileAsset[]
}

type HubTab = 'media' | 'docs' | 'links'

function renderInlineMarkdown(text: string): ReactNode[] {
	const nodes: ReactNode[] = []
	const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index))
		}
		const token = match[0]
		if (token.startsWith('**') && token.endsWith('**')) {
			nodes.push(
				<strong key={`b-${match.index}`} className="font-semibold text-[#f3f7dc]">
					{token.slice(2, -2)}
				</strong>
			)
		} else if (token.startsWith('`') && token.endsWith('`')) {
			nodes.push(
				<code
					key={`c-${match.index}`}
					className="px-1.5 py-0.5 rounded bg-[#1d1916] text-[#cedb9c] font-mono text-[0.9em]"
				>
					{token.slice(1, -1)}
				</code>
			)
		}
		lastIndex = pattern.lastIndex
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex))
	}
	return nodes
}

function SafeMarkdown({ content }: { content: string }) {
	const lines = content.replace(/\r\n/g, '\n').split('\n')
	const blocks: ReactNode[] = []
	let i = 0

	while (i < lines.length) {
		const trimmed = lines[i].trim()
		if (!trimmed) {
			i++
			continue
		}
		if (trimmed.startsWith('### ')) {
			blocks.push(
				<h4 key={`h3-${i}`} className="text-[16px] font-bold text-[#f3f7dc] mt-3 first:mt-0">
					{renderInlineMarkdown(trimmed.slice(4))}
				</h4>
			)
			i++
			continue
		}
		if (trimmed.startsWith('## ')) {
			blocks.push(
				<h3 key={`h2-${i}`} className="text-[17px] font-bold text-[#f3f7dc] mt-4 first:mt-0">
					{renderInlineMarkdown(trimmed.slice(3))}
				</h3>
			)
			i++
			continue
		}
		if (trimmed.startsWith('# ')) {
			blocks.push(
				<h2 key={`h1-${i}`} className="text-[19px] font-bold text-[#f3f7dc] mt-4 first:mt-0">
					{renderInlineMarkdown(trimmed.slice(2))}
				</h2>
			)
			i++
			continue
		}
		if (trimmed.startsWith('> ')) {
			const quoteLines: string[] = []
			while (i < lines.length && lines[i].trim().startsWith('> ')) {
				quoteLines.push(lines[i].trim().slice(2))
				i++
			}
			blocks.push(
				<blockquote
					key={`q-${i}`}
					className="pl-3.5 border-l-2 border-[#cedb9c]/70 text-[#d8e1bc] italic font-editorial text-[15px] leading-relaxed"
				>
					{quoteLines.map((ql, idx) => (
						<Fragment key={idx}>
							{renderInlineMarkdown(ql)}
							{idx < quoteLines.length - 1 && <br />}
						</Fragment>
					))}
				</blockquote>
			)
			continue
		}
		if (/^[-*]\s+/.test(trimmed)) {
			const items: string[] = []
			while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
				items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
				i++
			}
			blocks.push(
				<ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 text-[15px] text-[#e5ebcd] leading-relaxed">
					{items.map((item, idx) => (
						<li key={idx}>{renderInlineMarkdown(item)}</li>
					))}
				</ul>
			)
			continue
		}
		const paraLines: string[] = []
		while (
			i < lines.length &&
			lines[i].trim() &&
			!lines[i].trim().startsWith('#') &&
			!lines[i].trim().startsWith('> ') &&
			!/^[-*]\s+/.test(lines[i].trim())
		) {
			paraLines.push(lines[i].trim())
			i++
		}
		blocks.push(
			<p key={`p-${i}`} className="text-[15px] leading-relaxed text-[#e5ebcd]">
				{renderInlineMarkdown(paraLines.join(' '))}
			</p>
		)
	}

	return <div className="space-y-3">{blocks}</div>
}

function isPdfDoc(doc: FileAsset): boolean {
	return doc.contentType === 'application/pdf' || /\.pdf$/i.test(doc.filename)
}

function isMarkdownDoc(doc: FileAsset): boolean {
	return doc.contentType === 'text/markdown' || /\.(md|markdown)$/i.test(doc.filename)
}

function friendlyFormatLabel(doc: FileAsset): string {
	const name = doc.filename.toLowerCase()
	const ct = (doc.contentType || '').toLowerCase()

	if (ct === 'application/pdf' || name.endsWith('.pdf')) return 'PDF Document'
	if (ct === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'Markdown'
	if (name.endsWith('.ts') || name.endsWith('.tsx') || ct.includes('typescript')) return 'TypeScript'
	if (name.endsWith('.js') || name.endsWith('.jsx') || ct.includes('javascript')) return 'JavaScript'
	if (name.endsWith('.json') || ct === 'application/json') return 'JSON'
	if (name.endsWith('.py')) return 'Python'
	if (name.endsWith('.go')) return 'Go'
	if (name.endsWith('.rs')) return 'Rust'
	if (name.endsWith('.ex') || name.endsWith('.exs')) return 'Elixir'
	if (name.endsWith('.csv') || ct === 'text/csv') return 'CSV Spreadsheet'
	if (name.endsWith('.doc') || name.endsWith('.docx')) return 'Word Document'
	if (name.endsWith('.txt') || ct === 'text/plain') return 'Plain Text'
	if (name.endsWith('.html') || name.endsWith('.css')) return 'Web File'
	return 'Document'
}

function shortFormatBadge(doc: FileAsset): string {
	const name = doc.filename.toLowerCase()
	if (isPdfDoc(doc)) return 'PDF'
	if (isMarkdownDoc(doc)) return 'MD'
	if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TS'
	if (name.endsWith('.js') || name.endsWith('.jsx')) return 'JS'
	if (name.endsWith('.json')) return 'JSON'
	if (name.endsWith('.doc') || name.endsWith('.docx')) return 'Word'
	if (name.endsWith('.txt')) return 'Text'
	return 'File'
}

function formatFileSize(bytes: number): string {
	if (!bytes || bytes < 1024) return `${bytes || 0} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatCodeContent(doc: FileAsset): string {
	const raw = doc.previewText || 'Preview available when opened directly from Concord R2.'
	if (doc.contentType === 'application/json' || /\.json$/i.test(doc.filename)) {
		try {
			return JSON.stringify(JSON.parse(raw), null, 2)
		} catch {
			return raw
		}
	}
	return raw
}

function CodeViewer({ doc }: { doc: FileAsset }) {
	const [copied, setCopied] = useState(false)
	const text = formatCodeContent(doc)
	const lines = text.replace(/\r\n/g, '\n').split('\n')

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 1800)
		} catch {
			// Clipboard unavailable
		}
	}

	return (
		<div className="space-y-2.5" data-no-pane-swipe="true">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[12px] text-[#9e998c]">{lines.length} lines</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2c2621] hover:bg-[#37302a] text-[13px] font-medium text-[#e5ebcd] transition cursor-pointer"
				>
					<span>{copied ? 'Copied' : 'Copy'}</span>
				</button>
			</div>

			<div className="rounded-2xl bg-[#191512] overflow-x-auto max-h-[420px] overflow-y-auto">
				<div className="py-3 font-mono text-[13px] leading-relaxed min-w-max">
					{lines.map((line, idx) => (
						<div key={idx} className="flex hover:bg-white/[0.04] px-3">
							<span className="w-8 pr-3 text-right select-none text-[#7a7569] shrink-0">
								{idx + 1}
							</span>
							<span className="text-[#e5ebcd] whitespace-pre">{line || ' '}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

/**
 * Native in-app PDF.js Canvas Reader.
 * Works directly on Android WebView, Android Chrome, iOS Safari, and Desktop
 * for BOTH local blob: uploads and remote Concord R2 PDFs (zero blank iframes!).
 */
function PdfCanvasReader({
	url,
	maxPages = 12,
	compact = false,
}: {
	url: string
	maxPages?: number
	compact?: boolean
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [pageCount, setPageCount] = useState(0)
	const [renderedPages, setRenderedPages] = useState(0)
	const [errText, setErrText] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		const container = containerRef.current
		if (!container) return
		container.innerHTML = ''
		setStatus('loading')
		setPageCount(0)
		setRenderedPages(0)
		setErrText(null)

		;(async () => {
			try {
				const pdfjs = await import('pdfjs-dist')
				if (!pdfjs.GlobalWorkerOptions.workerSrc) {
					pdfjs.GlobalWorkerOptions.workerSrc =
						'https://unpkg.com/pdfjs-dist@6.5.438/build/pdf.worker.min.mjs'
				}

				const loadingTask = pdfjs.getDocument({ url, withCredentials: false })
				const pdf = await loadingTask.promise
				if (cancelled) {
					void loadingTask.destroy()
					return
				}

				const total = pdf.numPages
				const limit = Math.min(total, maxPages)
				setPageCount(total)
				setStatus('ready')

				const targetWidth = Math.max(260, (container.clientWidth || 320) - 4)
				const dpr = Math.min(window.devicePixelRatio || 1, 2)

				for (let p = 1; p <= limit; p++) {
					if (cancelled) break
					const page = await pdf.getPage(p)
					const baseViewport = page.getViewport({ scale: 1 })
					const scale = targetWidth / baseViewport.width
					const viewport = page.getViewport({ scale: scale * dpr })

					const canvas = document.createElement('canvas')
					canvas.width = Math.floor(viewport.width)
					canvas.height = Math.floor(viewport.height)
					canvas.style.width = '100%'
					canvas.style.height = 'auto'
					canvas.style.display = 'block'
					canvas.style.borderRadius = '12px'
					canvas.style.marginBottom = '10px'
					canvas.style.background = '#ffffff'

					const ctx = canvas.getContext('2d')
					if (ctx) {
						await page.render({ canvasContext: ctx, canvas, viewport }).promise
						if (!cancelled && containerRef.current) {
							containerRef.current.appendChild(canvas)
							setRenderedPages(p)
						}
					}
				}
			} catch (err) {
				if (!cancelled) {
					setStatus('error')
					setErrText(err instanceof Error ? err.message : 'Unable to render PDF')
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [url, maxPages])

	return (
		<div className="space-y-2.5" data-no-pane-swipe="true">
			{status === 'loading' && (
				<div className="rounded-2xl bg-[#1d1916] p-6 text-center text-[14px] text-[#9e998c]">
					Rendering PDF pages…
				</div>
			)}

			{status === 'error' && (
				<div className="rounded-2xl bg-[#1d1916] p-4 space-y-2 text-[14px] text-[#e5ebcd]">
					<div className="font-semibold">Could not render inline preview</div>
					<div className="text-[12px] text-[#9e998c]">{errText}</div>
				</div>
			)}

			{pageCount > 0 && (
				<div className="flex items-center justify-between text-[12px] text-[#9e998c]">
					<span>
						Showing {renderedPages} of {pageCount} {pageCount === 1 ? 'page' : 'pages'}
					</span>
				</div>
			)}

			<div
				ref={containerRef}
				className={`w-full overflow-y-auto no-scrollbar rounded-2xl ${
					compact ? 'max-h-[420px]' : 'flex-1'
				}`}
			/>
		</div>
	)
}

export function RightSpacePanel({ space, files }: RightSpacePanelProps) {
	const [tab, setTab] = useState<HubTab>('media')
	const [openDoc, setOpenDoc] = useState<FileAsset | null>(null)
	const [fullscreenPdf, setFullscreenPdf] = useState<FileAsset | null>(null)
	const [lightboxImage, setLightboxImage] = useState<FileAsset | null>(null)

	const media = files.filter((f) => f.kind === 'image' || f.kind === 'video' || f.kind === 'audio')
	const docs = files.filter((f) => f.kind === 'doc')
	const links = files.filter((f) => f.kind === 'link')

	useEffect(() => {
		setOpenDoc(null)
		setFullscreenPdf(null)
		setLightboxImage(null)
	}, [space.id])

	useEffect(() => {
		if (!lightboxImage && !fullscreenPdf) return
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setLightboxImage(null)
				setFullscreenPdf(null)
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [lightboxImage, fullscreenPdf])

	const openPdfUrl = openDoc && isPdfDoc(openDoc) ? safeStorageUrl(openDoc.url, true) : null
	const fullscreenPdfUrl = fullscreenPdf ? safeStorageUrl(fullscreenPdf.url, true) : null

	return (
		<aside className="h-full flex flex-col bg-[#221d19] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Space Header (No Back button — swipe to close) */}
			<div className="px-4 pt-4 pb-3 flex items-center gap-3">
				<div
					className={`w-10 h-10 rounded-full bg-gradient-to-br ${space.orbGradient} shrink-0 flex items-center justify-center text-[15px] font-bold text-[#edf3d2]`}
				>
					{space.name[0]}
				</div>
				<div className="min-w-0">
					<h2 className="text-[18px] font-bold text-[#edf3d2] truncate font-heading">{space.name}</h2>
					<p className="text-[13px] text-[#9e998c] truncate">{space.description || 'Shared in Space'}</p>
				</div>
			</div>

			{/* 3 Clean Tabs: Media | Docs | Links */}
			<div className="px-4 pb-3.5">
				<div className="grid grid-cols-3 gap-1 bg-[#1b1714] p-1 rounded-2xl">
					{(
						[
							['media', 'Media'],
							['docs', 'Docs'],
							['links', 'Links'],
						] as [HubTab, string][]
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								setTab(key)
								setOpenDoc(null)
							}}
							className={`py-2 rounded-xl text-[14px] font-semibold transition cursor-pointer ${
								tab === key ? 'bg-[#2f2923] text-[#edf3d2]' : 'text-[#9e998c] hover:text-[#e5ebcd]'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{/* Content Area */}
			<div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
				{openDoc ? (
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-2">
							<button
								type="button"
								onClick={() => setOpenDoc(null)}
								className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#cedb9c] hover:text-[#edf3d2] cursor-pointer"
							>
								<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
								</svg>
								<span>All docs</span>
							</button>
							<div className="flex items-center gap-2">
								{openPdfUrl && (
									<button
										type="button"
										onClick={() => setFullscreenPdf(openDoc)}
										className="px-3 py-1 rounded-full bg-[#cedb9c] text-[#1d1916] text-[12px] font-bold cursor-pointer"
									>
										Full Screen
									</button>
								)}
								{safeMediaUrl(openDoc.url) && (
									<a
										href={safeMediaUrl(openDoc.url) ?? undefined}
										target="_blank"
										rel="noopener noreferrer"
										className="text-[13px] font-semibold text-[#9e998c] hover:text-[#edf3d2]"
									>
										Open
									</a>
								)}
							</div>
						</div>

						{/* Espresso & Lichen Document Reader Card */}
						<div className="rounded-2xl bg-[#2a241f] p-4 space-y-3">
							<div className="text-[16px] font-semibold text-[#edf3d2] truncate">{openDoc.filename}</div>
							<div className="text-[13px] text-[#9e998c]">
								{friendlyFormatLabel(openDoc)} &bull; {formatFileSize(openDoc.sizeBytes)}
							</div>

							{isPdfDoc(openDoc) ? (
								<div className="pt-2">
									{openPdfUrl ? (
										<PdfCanvasReader url={openPdfUrl} maxPages={8} compact />
									) : (
										<div className="rounded-xl bg-[#1d1916] p-4 text-[14px] text-[#9e998c]">
											PDF preview is enabled for verified Concord R2 files and local uploads.
										</div>
									)}
								</div>
							) : isMarkdownDoc(openDoc) ? (
								<div className="pt-2">
									<SafeMarkdown
										content={openDoc.previewText || 'Preview available when opened directly from R2.'}
									/>
								</div>
							) : (
								<div className="pt-2">
									<CodeViewer doc={openDoc} />
								</div>
							)}
						</div>
					</div>
				) : (
					<>
						{tab === 'media' && (
							<div className="grid grid-cols-2 gap-2.5">
								{media.length === 0 ? (
									<p className="col-span-2 text-[14px] text-[#9e998c] text-center py-10">
										No media shared yet.
									</p>
								) : (
									media.map((item) => {
										const safeUrl = safeMediaUrl(item.url)
										if (!safeUrl) return null
										if (item.kind === 'audio') {
											return (
												<div
													key={item.id}
													data-no-pane-swipe="true"
													className="col-span-2 rounded-2xl bg-[#2a241f] p-3.5 space-y-2"
												>
													<div className="flex items-center justify-between gap-2 text-[13px]">
														<span className="font-semibold text-[#edf3d2] truncate">{item.filename}</span>
														<span className="text-[12px] text-[#9e998c] shrink-0">Audio</span>
													</div>
													<audio src={safeUrl} controls preload="metadata" className="w-full h-9" />
												</div>
											)
										}
										if (item.kind === 'video') {
											return (
												<a
													key={item.id}
													href={safeUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="aspect-square rounded-2xl overflow-hidden relative bg-black flex items-center justify-center group"
												>
													<video src={safeUrl} muted playsInline className="w-full h-full object-cover opacity-85" />
													<div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition">
														<span className="w-11 h-11 rounded-full bg-black/75 flex items-center justify-center text-white">
															<svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
																<path d="M6 4l15 8-15 8V4z" />
															</svg>
														</span>
													</div>
												</a>
											)
										}
										return (
											<button
												key={item.id}
												type="button"
												onClick={() => setLightboxImage(item)}
												className="aspect-square rounded-2xl overflow-hidden block cursor-pointer"
											>
												<img
													src={safeUrl}
													alt={item.filename}
													className="w-full h-full object-cover hover:scale-105 transition duration-200"
												/>
											</button>
										)
									})
								)}
							</div>
						)}

						{tab === 'docs' && (
							<div className="space-y-2.5">
								{docs.length === 0 ? (
									<p className="text-[14px] text-[#9e998c] text-center py-10">No documents shared yet.</p>
								) : (
									docs.map((doc) => (
										<button
											key={doc.id}
											type="button"
											onClick={() => setOpenDoc(doc)}
											className="w-full text-left rounded-2xl bg-[#2a241f] hover:bg-[#332c26] p-4 transition cursor-pointer flex items-center justify-between gap-3"
										>
											<div className="min-w-0">
												<div className="text-[15px] font-semibold text-[#edf3d2] truncate">{doc.filename}</div>
												<div className="text-[13px] text-[#9e998c] mt-0.5">
													{friendlyFormatLabel(doc)} &bull; {formatFileSize(doc.sizeBytes)}
												</div>
											</div>
											<span className="text-[12px] text-[#9e998c] shrink-0">
												{shortFormatBadge(doc)}
											</span>
										</button>
									))
								)}
							</div>
						)}

						{tab === 'links' && (
							<div className="space-y-2.5">
								{links.length === 0 ? (
									<p className="text-[14px] text-[#9e998c] text-center py-10">No links collected yet.</p>
								) : (
									links.map((l) => {
										const safeLink = safeHttpsUrl(l.url)
										if (!safeLink) return null
										return (
											<a
												key={l.id}
												href={safeLink}
												target="_blank"
												rel="noopener noreferrer"
												className="block rounded-2xl bg-[#2a241f] hover:bg-[#332c26] p-4 transition"
											>
												<div className="text-[14px] font-semibold text-[#cedb9c] truncate">{safeLink}</div>
												<div className="text-[12px] text-[#9e998c] mt-1">{l.createdAt}</div>
											</a>
										)
									})
								)}
							</div>
						)}
					</>
				)}
			</div>

			{/* Full-Screen PDF.js Canvas Reader Modal */}
			{fullscreenPdf && fullscreenPdfUrl && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label={fullscreenPdf.filename}
					data-no-pane-swipe="true"
					className="fixed inset-0 z-50 bg-[#1d1916] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
				>
					<div className="px-4 py-3 bg-[#241f1b] flex items-center justify-between gap-3 shrink-0">
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#edf3d2] truncate">{fullscreenPdf.filename}</div>
							<div className="text-[12px] text-[#9e998c]">
								PDF Document &bull; {formatFileSize(fullscreenPdf.sizeBytes)}
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<a
								href={fullscreenPdfUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="px-3.5 py-2 rounded-full bg-[#2f2923] hover:bg-[#3a322b] text-[13px] font-semibold text-[#e5ebcd]"
							>
								Open
							</a>
							<button
								type="button"
								onClick={() => setFullscreenPdf(null)}
								className="px-4 py-2 rounded-full bg-[#cedb9c] text-[#1d1916] text-[13px] font-bold cursor-pointer"
							>
								Close
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-y-auto px-3 py-4">
						<div className="max-w-3xl mx-auto">
							<PdfCanvasReader url={fullscreenPdfUrl} maxPages={50} />
						</div>
					</div>
				</div>
			)}

			{/* Full-Screen Media Lightbox Modal */}
			{lightboxImage && safeMediaUrl(lightboxImage.url) && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label={lightboxImage.filename}
					onClick={() => setLightboxImage(null)}
					className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
				>
					<div
						onClick={(e) => e.stopPropagation()}
						className="flex items-center justify-between gap-3 pb-3"
					>
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#edf3d2] truncate">{lightboxImage.filename}</div>
							<div className="text-[13px] text-[#9e998c]">
								{formatFileSize(lightboxImage.sizeBytes)} &bull; {lightboxImage.createdAt}
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<a
								href={safeMediaUrl(lightboxImage.url) ?? undefined}
								download={lightboxImage.filename}
								target="_blank"
								rel="noopener noreferrer"
								className="px-3.5 py-2 rounded-full bg-[#2a241f] hover:bg-[#352e28] text-[13px] font-semibold text-[#e5ebcd] transition"
							>
								Download
							</a>
							<button
								type="button"
								onClick={() => setLightboxImage(null)}
								aria-label="Close lightbox"
								className="px-4 py-2 rounded-full bg-[#cedb9c] text-[#1d1916] text-[13px] font-bold transition cursor-pointer"
							>
								Close
							</button>
						</div>
					</div>
					<div
						onClick={(e) => e.stopPropagation()}
						className="flex-1 flex items-center justify-center overflow-hidden"
					>
						<img
							src={safeMediaUrl(lightboxImage.url) ?? undefined}
							alt={lightboxImage.filename}
							className="max-h-full max-w-full object-contain rounded-2xl"
						/>
					</div>
				</div>
			)}
		</aside>
	)
}
