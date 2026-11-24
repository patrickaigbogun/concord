import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { safeHttpsUrl, safeMediaUrl, safeStorageUrl } from '../../lib/url'
import type { FileAsset, Space } from '../../lib/types'

interface RightSpacePanelProps {
	space: Space
	files: FileAsset[]
	onCloseMobile?: () => void
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
				<strong key={`b-${match.index}`} className="font-semibold text-white">
					{token.slice(2, -2)}
				</strong>
			)
		} else if (token.startsWith('`') && token.endsWith('`')) {
			nodes.push(
				<code
					key={`c-${match.index}`}
					className="px-1.5 py-0.5 rounded bg-white/10 text-[#c4b5fd] font-mono text-[0.9em]"
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
				<h4 key={`h3-${i}`} className="text-[16px] font-bold text-white mt-3 first:mt-0">
					{renderInlineMarkdown(trimmed.slice(4))}
				</h4>
			)
			i++
			continue
		}
		if (trimmed.startsWith('## ')) {
			blocks.push(
				<h3 key={`h2-${i}`} className="text-[17px] font-bold text-white mt-4 first:mt-0">
					{renderInlineMarkdown(trimmed.slice(3))}
				</h3>
			)
			i++
			continue
		}
		if (trimmed.startsWith('# ')) {
			blocks.push(
				<h2 key={`h1-${i}`} className="text-[19px] font-bold text-white mt-4 first:mt-0">
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
					className="pl-3.5 border-l-2 border-[#8b5cf6]/70 text-zinc-300 italic font-editorial text-[15px] leading-relaxed"
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
				<ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 text-[15px] text-zinc-200 leading-relaxed">
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
			<p key={`p-${i}`} className="text-[15px] leading-relaxed text-zinc-200">
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
				<span className="text-[12px] text-zinc-400 font-mono">{lines.length} lines</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[13px] font-medium text-zinc-100 transition cursor-pointer"
				>
					<span>{copied ? 'Copied' : 'Copy'}</span>
				</button>
			</div>

			<div className="rounded-2xl bg-[#09090d] overflow-x-auto max-h-[420px] overflow-y-auto">
				<div className="py-3 font-mono text-[13px] leading-relaxed min-w-max">
					{lines.map((line, idx) => (
						<div key={idx} className="flex hover:bg-white/[0.04] px-3">
							<span className="w-8 pr-3 text-right select-none text-zinc-600 shrink-0">
								{idx + 1}
							</span>
							<span className="text-zinc-200 whitespace-pre">{line || ' '}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export function RightSpacePanel({
	space,
	files,
	onCloseMobile,
}: RightSpacePanelProps) {
	const [tab, setTab] = useState<HubTab>('media')
	const [openDoc, setOpenDoc] = useState<FileAsset | null>(null)
	const [lightboxImage, setLightboxImage] = useState<FileAsset | null>(null)

	const media = files.filter((f) => f.kind === 'image' || f.kind === 'video' || f.kind === 'audio')
	const docs = files.filter((f) => f.kind === 'doc')
	const links = files.filter((f) => f.kind === 'link')

	useEffect(() => {
		setOpenDoc(null)
		setLightboxImage(null)
	}, [space.id])

	useEffect(() => {
		if (!lightboxImage) return
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setLightboxImage(null)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [lightboxImage])

	return (
		<aside className="h-full flex flex-col bg-[#0d0d11] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Space Header */}
			<div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-3 min-w-0">
					<div
						className={`w-10 h-10 rounded-full bg-gradient-to-br ${space.orbGradient} shrink-0 flex items-center justify-center text-[15px] font-bold text-white`}
					>
						{space.name[0]}
					</div>
					<div className="min-w-0">
						<h2 className="text-[17px] font-bold text-white truncate">{space.name}</h2>
						<p className="text-[13px] text-zinc-400 truncate">{space.description || 'Shared in Space'}</p>
					</div>
				</div>
				{onCloseMobile && (
					<button
						type="button"
						onClick={onCloseMobile}
						className="lg:hidden inline-flex items-center gap-1 text-[14px] font-medium text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl bg-[#16161c] cursor-pointer shrink-0"
					>
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
						</svg>
						<span>Back</span>
					</button>
				)}
			</div>

			{/* 3 Clean Space Hub Tabs: Media | Docs | Links */}
			<div className="px-4 pb-3">
				<div className="grid grid-cols-3 gap-1 bg-[#16161c] p-1 rounded-2xl">
					{(
						[
							['media', `Media (${media.length})`],
							['docs', `Docs (${docs.length})`],
							['links', `Links (${links.length})`],
						] as [HubTab, string][]
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								setTab(key)
								setOpenDoc(null)
							}}
							className={`py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
								tab === key ? 'bg-white/14 text-white' : 'text-zinc-400 hover:text-zinc-200'
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
								className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#a78bfa] hover:text-[#c4b5fd] cursor-pointer"
							>
								<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
								</svg>
								<span>All docs</span>
							</button>
							{safeMediaUrl(openDoc.url) && (
								<a
									href={safeMediaUrl(openDoc.url) ?? undefined}
									target="_blank"
									rel="noopener noreferrer"
									className="text-[13px] font-medium text-zinc-400 hover:text-white"
								>
									Open
								</a>
							)}
						</div>

						<div className="rounded-2xl bg-[#15151b] p-4 space-y-3">
							<div className="text-[15px] font-semibold text-white truncate">{openDoc.filename}</div>
							<div className="text-[12px] text-zinc-400">
								{openDoc.contentType} &bull; {(openDoc.sizeBytes / 1024).toFixed(1)} KB
							</div>

							{isPdfDoc(openDoc) ? (
								<div className="pt-2 space-y-3">
									{safeStorageUrl(openDoc.url, true) ? (
										<>
											<iframe
												src={safeStorageUrl(openDoc.url, true) ?? undefined}
												title={openDoc.filename}
												sandbox="allow-scripts allow-same-origin"
												referrerPolicy="no-referrer"
												className="w-full h-[420px] rounded-xl bg-white"
											/>
											<a
												href={safeStorageUrl(openDoc.url, true) ?? undefined}
												target="_blank"
												rel="noopener noreferrer"
												className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[14px] font-semibold text-white transition"
											>
												Open PDF in new tab
											</a>
										</>
									) : (
										<div className="rounded-xl bg-white/[0.04] p-4 text-[14px] text-zinc-400">
											PDF preview is enabled for verified Concord R2 files.
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
									<p className="col-span-2 text-[14px] text-zinc-500 text-center py-10">
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
													className="col-span-2 rounded-2xl bg-[#15151b] p-3.5 space-y-2"
												>
													<div className="flex items-center justify-between gap-2 text-[13px]">
														<span className="font-semibold text-white truncate">{item.filename}</span>
														<span className="text-[12px] text-[#a78bfa] shrink-0">Audio</span>
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
												<img src={safeUrl} alt={item.filename} className="w-full h-full object-cover hover:scale-105 transition duration-200" />
											</button>
										)
									})
								)}
							</div>
						)}

						{tab === 'docs' && (
							<div className="space-y-2.5">
								{docs.length === 0 ? (
									<p className="text-[14px] text-zinc-500 text-center py-10">No documents shared yet.</p>
								) : (
									docs.map((doc) => (
										<button
											key={doc.id}
											type="button"
											onClick={() => setOpenDoc(doc)}
											className="w-full text-left rounded-2xl bg-[#15151b] hover:bg-[#1c1c24] p-4 transition cursor-pointer flex items-center justify-between gap-3"
										>
											<div className="min-w-0">
												<div className="text-[15px] font-semibold text-white truncate">{doc.filename}</div>
												<div className="text-[13px] text-zinc-400 mt-0.5">
													{(doc.sizeBytes / 1024).toFixed(1)} KB &bull; {doc.createdAt}
												</div>
											</div>
											<span className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-zinc-200 shrink-0">
												{isPdfDoc(doc) ? 'PDF' : isMarkdownDoc(doc) ? 'MD' : 'Doc'}
											</span>
										</button>
									))
								)}
							</div>
						)}

						{tab === 'links' && (
							<div className="space-y-2.5">
								{links.length === 0 ? (
									<p className="text-[14px] text-zinc-500 text-center py-10">No links collected yet.</p>
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
												className="block rounded-2xl bg-[#15151b] hover:bg-[#1c1c24] p-4 transition"
											>
												<div className="text-[14px] font-semibold text-[#a78bfa] truncate">{safeLink}</div>
												<div className="text-[12px] text-zinc-500 mt-1">{l.createdAt}</div>
											</a>
										)
									})
								)}
							</div>
						)}
					</>
				)}
			</div>

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
							<div className="text-[15px] font-semibold text-white truncate">{lightboxImage.filename}</div>
							<div className="text-[13px] text-zinc-400">
								{(lightboxImage.sizeBytes / 1024).toFixed(1)} KB &bull; {lightboxImage.createdAt}
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<a
								href={safeMediaUrl(lightboxImage.url) ?? undefined}
								download={lightboxImage.filename}
								target="_blank"
								rel="noopener noreferrer"
								className="px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 text-[13px] font-semibold text-white transition"
							>
								Download
							</a>
							<button
								type="button"
								onClick={() => setLightboxImage(null)}
								aria-label="Close lightbox"
								className="px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 text-[13px] font-semibold text-white transition cursor-pointer"
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
