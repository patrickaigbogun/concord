import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { safeHttpsUrl, safeMediaUrl, safeStorageUrl } from '../../lib/url'
import type { FileAsset, SeriesPost, Space } from '../../lib/types'

interface RightSpacePanelProps {
	space: Space
	posts: SeriesPost[]
	files: FileAsset[]
	onCloseMobile?: () => void
	onEchoPost?: (postId: string) => void
	onAddComment?: (postId: string, content: string) => void
	onPublishPost?: () => void
}

type HubTab = 'series' | 'docs' | 'media' | 'links'

interface LocalComment {
	id: string
	author: string
	content: string
	createdAt: string
}

/**
 * Renders inline Markdown tokens (**bold** and `inline code`) purely as React elements (zero HTML injection).
 */
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
					className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[#c4b5fd] font-mono text-[0.85em]"
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

/**
 * Safe native Markdown renderer using pure React elements (no dangerouslySetInnerHTML).
 * Supports #, ##, ### headings, > blockquotes, - bullet lists, **bold**, `inline code`, and paragraphs.
 */
function SafeMarkdown({ content, editorial = false }: { content: string; editorial?: boolean }) {
	const lines = content.replace(/\r\n/g, '\n').split('\n')
	const blocks: ReactNode[] = []
	let i = 0

	while (i < lines.length) {
		const rawLine = lines[i]
		const trimmed = rawLine.trim()

		if (!trimmed) {
			i++
			continue
		}

		// Headings: ###, ##, #
		if (trimmed.startsWith('### ')) {
			blocks.push(
				<h4 key={`h3-${i}`} className="text-sm font-bold text-white pt-2 leading-snug">
					{renderInlineMarkdown(trimmed.slice(4))}
				</h4>
			)
			i++
			continue
		}
		if (trimmed.startsWith('## ')) {
			blocks.push(
				<h3 key={`h2-${i}`} className="text-base font-bold text-white pt-2.5 leading-snug">
					{renderInlineMarkdown(trimmed.slice(3))}
				</h3>
			)
			i++
			continue
		}
		if (trimmed.startsWith('# ')) {
			blocks.push(
				<h2 key={`h1-${i}`} className="text-lg font-bold text-white pt-3 leading-snug">
					{renderInlineMarkdown(trimmed.slice(2))}
				</h2>
			)
			i++
			continue
		}

		// Blockquote (> ...)
		if (trimmed.startsWith('>')) {
			const quoteLines: string[] = []
			while (i < lines.length && lines[i].trim().startsWith('>')) {
				quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
				i++
			}
			blocks.push(
				<blockquote
					key={`q-${i}`}
					className="border-l-2 border-[#8b5cf6] pl-3 py-1 my-2 text-zinc-300 italic bg-white/[0.02] rounded-r-lg space-y-1"
				>
					{quoteLines.map((ql, idx) => (
						<p key={idx} className="leading-relaxed">
							{renderInlineMarkdown(ql)}
						</p>
					))}
				</blockquote>
			)
			continue
		}

		// Bullet list (- ...)
		if (trimmed.startsWith('- ')) {
			const items: string[] = []
			while (i < lines.length && lines[i].trim().startsWith('- ')) {
				items.push(lines[i].trim().slice(2))
				i++
			}
			blocks.push(
				<ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 text-zinc-200">
					{items.map((item, idx) => (
						<li key={idx} className="leading-relaxed">
							{renderInlineMarkdown(item)}
						</li>
					))}
				</ul>
			)
			continue
		}

		// Paragraph: group consecutive plain lines until blank line or block syntax
		const paraLines: string[] = []
		while (i < lines.length) {
			const cur = lines[i].trim()
			if (
				!cur ||
				cur.startsWith('# ') ||
				cur.startsWith('## ') ||
				cur.startsWith('### ') ||
				cur.startsWith('>') ||
				cur.startsWith('- ')
			) {
				break
			}
			paraLines.push(cur)
			i++
		}
		blocks.push(
			<p key={`p-${i}`} className="text-zinc-200 leading-relaxed">
				{paraLines.map((pl, idx) => (
					<Fragment key={idx}>
						{idx > 0 && <br />}
						{renderInlineMarkdown(pl)}
					</Fragment>
				))}
			</p>
		)
	}

	return (
		<div className={`space-y-2.5 text-sm ${editorial ? 'font-editorial' : ''}`}>
			{blocks}
		</div>
	)
}

function isMarkdownDoc(doc: FileAsset): boolean {
	return doc.contentType === 'text/markdown' || /\.md$/i.test(doc.filename)
}

function isPdfDoc(doc: FileAsset): boolean {
	return doc.contentType === 'application/pdf' || /\.pdf$/i.test(doc.filename)
}

function formatDocText(doc: FileAsset): string {
	const raw = doc.previewText || ''
	if (!raw) return 'Preview available when opened directly from R2.'
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
	const text = formatDocText(doc)
	const lines = text.replace(/\r\n/g, '\n').split('\n')

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 1800)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div className="pt-3 border-t border-white/[0.06] space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
					{lines.length} {lines.length === 1 ? 'line' : 'lines'}
				</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-[11px] font-medium text-zinc-200 transition cursor-pointer"
				>
					{copied ? (
						<>
							<svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							<span className="text-emerald-300">Copied</span>
						</>
					) : (
						<>
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="9" y="9" width="13" height="13" rx="2" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
							</svg>
							<span>Copy</span>
						</>
					)}
				</button>
			</div>

			<div className="rounded-xl bg-[#09090c] border border-white/[0.06] overflow-x-auto max-h-[420px] overflow-y-auto">
				<div className="py-2.5 font-mono text-[11px] leading-relaxed min-w-max">
					{lines.map((line, idx) => (
						<div key={idx} className="flex hover:bg-white/[0.03] px-2.5">
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
	posts,
	files,
	onCloseMobile,
	onEchoPost,
	onAddComment,
	onPublishPost,
}: RightSpacePanelProps) {
	const [tab, setTab] = useState<HubTab>('series')
	const [openDoc, setOpenDoc] = useState<FileAsset | null>(null)
	const [openPostId, setOpenPostId] = useState<string | null>(null)
	const [lightboxImage, setLightboxImage] = useState<FileAsset | null>(null)

	// Series echo & comments local feedback
	const [echoedPosts, setEchoedPosts] = useState<Record<string, boolean>>({})
	const [localComments, setLocalComments] = useState<Record<string, LocalComment[]>>({})
	const [commentDraft, setCommentDraft] = useState('')

	const openPost = openPostId ? posts.find((p) => p.id === openPostId) ?? null : null

	const docs = files.filter((f) => f.kind === 'doc')
	const media = files.filter((f) => f.kind === 'image' || f.kind === 'video' || f.kind === 'audio')
	const links = files.filter((f) => f.kind === 'link')

	// Reset open readers/lightbox when switching Spaces
	useEffect(() => {
		setOpenDoc(null)
		setOpenPostId(null)
		setLightboxImage(null)
		setCommentDraft('')
	}, [space.id])

	useEffect(() => {
		if (!lightboxImage) return
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setLightboxImage(null)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [lightboxImage])

	const handleEcho = (postId: string) => {
		setEchoedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }))
		onEchoPost?.(postId)
	}

	const handleSubmitComment = (e: React.FormEvent, postId: string) => {
		e.preventDefault()
		const content = commentDraft.trim()
		if (!content) return
		setLocalComments((prev) => ({
			...prev,
			[postId]: [
				...(prev[postId] || []),
				{
					id: `comment-${Date.now()}`,
					author: 'You',
					content,
					createdAt: 'Just now',
				},
			],
		}))
		setCommentDraft('')
		onAddComment?.(postId, content)
	}

	return (
		<aside className="h-full flex flex-col bg-[#0d0d10] border-l border-white/[0.07]">
			{/* Space Header */}
			<div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
				<div className="flex items-center gap-2.5 min-w-0">
					<div
						className={`w-8 h-8 rounded-full bg-gradient-to-br ${space.orbGradient} shrink-0 flex items-center justify-center text-xs font-bold text-white`}
					>
						{space.name[0]}
					</div>
					<div className="min-w-0">
						<h2 className="text-sm font-bold text-zinc-100 truncate">{space.name}</h2>
						<p className="text-[11px] text-zinc-500 truncate">{space.description || 'Space Hub'}</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					{onPublishPost && (
						<button
							type="button"
							onClick={onPublishPost}
							title="Publish Series issue"
							className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c4b5fd] hover:text-white px-2 py-1 rounded-lg bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/30 transition cursor-pointer"
						>
							<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span>Publish</span>
						</button>
					)}
					{onCloseMobile && (
						<button
							type="button"
							onClick={onCloseMobile}
							className="lg:hidden inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-white/[0.05] cursor-pointer"
						>
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
							</svg>
							<span>Back</span>
						</button>
					)}
				</div>
			</div>

			{/* Mega-Hub Tabs */}
			<div className="px-3 pt-3 pb-2">
				<div className="grid grid-cols-4 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
					{(
						[
							['series', 'Series'],
							['docs', 'Docs'],
							['media', 'Media'],
							['links', 'Links'],
						] as [HubTab, string][]
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								setTab(key)
								setOpenDoc(null)
								setOpenPostId(null)
							}}
							className={`py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
								tab === key ? 'bg-white/12 text-white' : 'text-zinc-500 hover:text-zinc-300'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{/* Content Area */}
			<div className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-2 space-y-3">
				{/* Native Post / Series Reader */}
				{openPost ? (
					<div className="space-y-3 pb-4">
						<button
							type="button"
							onClick={() => setOpenPostId(null)}
							className="inline-flex items-center gap-1.5 text-xs text-[#a78bfa] hover:text-[#c4b5fd] cursor-pointer"
						>
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
							</svg>
							<span>All issues</span>
						</button>

						<article className="rounded-2xl border border-white/[0.08] bg-[#121217] p-4 space-y-3">
							<div className="text-[10px] uppercase tracking-widest text-[#a78bfa] font-semibold">
								Issue {openPost.issueNumber || 1} &bull; {openPost.publishedAt}
							</div>
							<h3 className="text-lg font-bold font-editorial text-white leading-snug">
								{openPost.title}
							</h3>
							<div className="text-xs text-zinc-500">
								By {openPost.authorName} (@{openPost.authorHandle})
							</div>
							<div className="pt-3 border-t border-white/[0.06]">
								<SafeMarkdown content={openPost.body} editorial />
							</div>

							{/* Echo & Comment Action Bar */}
							<div className="pt-3 border-t border-white/[0.06] flex items-center gap-2">
								<button
									type="button"
									onClick={() => handleEcho(openPost.id)}
									className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
										echoedPosts[openPost.id]
											? 'bg-[#8b5cf6]/25 text-[#c4b5fd] border border-[#8b5cf6]/40'
											: 'bg-white/[0.05] hover:bg-white/10 text-zinc-300 border border-white/[0.06]'
									}`}
								>
									<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M7 17l-4-4 4-4M3 13h11a4 4 0 004-4V7M17 7l4 4-4 4M21 11H10a4 4 0 00-4 4v2"
										/>
									</svg>
									<span>Echo</span>
									<span className="font-mono text-[11px]">
										{openPost.echoCount + (echoedPosts[openPost.id] && !onEchoPost ? 1 : 0)}
									</span>
								</button>

								<div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400">
									<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
										/>
									</svg>
									<span className="font-mono text-[11px]">
										{openPost.commentCount + (!onAddComment ? (localComments[openPost.id]?.length || 0) : 0)}
									</span>
								</div>
							</div>
						</article>

						{/* Comments Section */}
						<section className="rounded-2xl border border-white/[0.08] bg-[#121217] p-3.5 space-y-3">
							<div className="text-xs font-semibold text-zinc-200">Comments</div>

							{(localComments[openPost.id] || []).length === 0 ? (
								<p className="text-[11px] text-zinc-500">
									Share a thought or response on this issue.
								</p>
							) : (
								<div className="space-y-2">
									{(localComments[openPost.id] || []).map((c) => (
										<div
											key={c.id}
											className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-1"
										>
											<div className="flex items-center justify-between text-[10px]">
												<span className="font-semibold text-zinc-200">{c.author}</span>
												<span className="text-zinc-500">{c.createdAt}</span>
											</div>
											<p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
										</div>
									))}
								</div>
							)}

							<form onSubmit={(e) => handleSubmitComment(e, openPost.id)} className="flex gap-2">
								<input
									type="text"
									value={commentDraft}
									onChange={(e) => setCommentDraft(e.target.value)}
									placeholder="Write a comment..."
									className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#8b5cf6]/50"
								/>
								<button
									type="submit"
									disabled={!commentDraft.trim()}
									className="px-3 py-1.5 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
								>
									Post
								</button>
							</form>
						</section>
					</div>
				) : openDoc ? (
					/* Native Multi-Format Document Viewer */
					<div className="space-y-3 pb-4">
						<div className="flex items-center justify-between gap-2">
							<button
								type="button"
								onClick={() => setOpenDoc(null)}
								className="inline-flex items-center gap-1.5 text-xs text-[#a78bfa] hover:text-[#c4b5fd] cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
								</svg>
								<span>All docs</span>
							</button>
							{safeMediaUrl(openDoc.url) && (
								<a
									href={safeMediaUrl(openDoc.url) ?? undefined}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
								>
									<span>Open in new tab</span>
									<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
									</svg>
								</a>
							)}
						</div>

						<div className="rounded-2xl border border-white/[0.08] bg-[#121217] p-4 space-y-2.5">
							<div className="flex items-center justify-between gap-2">
								<div className="text-xs font-semibold text-white truncate">{openDoc.filename}</div>
								<span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 uppercase shrink-0">
									{isPdfDoc(openDoc) ? 'PDF' : isMarkdownDoc(openDoc) ? 'Markdown' : 'Text'}
								</span>
							</div>
							<div className="text-[10px] text-zinc-500">
								{openDoc.contentType} &bull; {(openDoc.sizeBytes / 1024).toFixed(1)} KB
							</div>

							{isPdfDoc(openDoc) ? (
								<div className="pt-3 border-t border-white/[0.06] space-y-2.5">
									{safeStorageUrl(openDoc.url, true) ? (
										<>
											<iframe
												src={safeStorageUrl(openDoc.url, true) ?? undefined}
												title={openDoc.filename}
												sandbox="allow-scripts allow-same-origin"
												referrerPolicy="no-referrer"
												className="w-full h-[420px] rounded-xl border border-white/10 bg-white"
											/>
											<a
												href={safeStorageUrl(openDoc.url, true) ?? undefined}
												target="_blank"
												rel="noopener noreferrer"
												className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/12 text-xs font-medium text-zinc-200 transition"
											>
												<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
												</svg>
												<span>Open PDF in new tab</span>
											</a>
										</>
									) : (
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-xs text-zinc-400">
											PDF preview is only enabled for verified Concord R2 storage files.
										</div>
									)}
								</div>
							) : isMarkdownDoc(openDoc) ? (
								<div className="pt-3 border-t border-white/[0.06]">
									<SafeMarkdown
										content={openDoc.previewText || 'Preview available when opened directly from R2.'}
									/>
								</div>
							) : (
								<CodeViewer doc={openDoc} />
							)}
						</div>
					</div>
				) : (
					<>
						{tab === 'series' && (
							<div className="space-y-2.5">
								{posts.length === 0 ? (
									<p className="text-xs text-zinc-500 text-center py-8">No published issues in this Space yet.</p>
								) : (
									posts.map((post) => (
										<button
											key={post.id}
											type="button"
											onClick={() => setOpenPostId(post.id)}
											className="w-full text-left rounded-2xl border border-white/[0.07] hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04] p-3.5 transition space-y-1.5 cursor-pointer"
										>
											<div className="flex items-center justify-between text-[10px] text-zinc-500">
												<span className="text-[#a78bfa] font-semibold">
													Issue {post.issueNumber || 1}
												</span>
												<span>{post.publishedAt}</span>
											</div>
											<div className="text-sm font-semibold font-editorial text-zinc-100 leading-snug">
												{post.title}
											</div>
											<p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{post.excerpt}</p>
											<div className="pt-1 text-[10px] text-zinc-500 flex items-center gap-3">
												<span>
													{post.echoCount + (echoedPosts[post.id] && !onEchoPost ? 1 : 0)} echos
												</span>
												<span>
													{post.commentCount + (!onAddComment ? (localComments[post.id]?.length || 0) : 0)} comments
												</span>
											</div>
										</button>
									))
								)}
							</div>
						)}

						{tab === 'docs' && (
							<div className="space-y-2">
								{docs.length === 0 ? (
									<p className="text-xs text-zinc-500 text-center py-8">No documents shared yet.</p>
								) : (
									docs.map((doc) => (
										<button
											key={doc.id}
											type="button"
											onClick={() => setOpenDoc(doc)}
											className="w-full text-left rounded-xl border border-white/[0.07] hover:border-[#8b5cf6]/40 bg-white/[0.02] hover:bg-white/[0.04] p-3 transition flex items-center justify-between gap-2 cursor-pointer"
										>
											<div className="min-w-0">
												<div className="text-xs font-semibold text-zinc-100 truncate">{doc.filename}</div>
												<div className="text-[10px] text-zinc-500 mt-0.5">
													{(doc.sizeBytes / 1024).toFixed(1)} KB &bull; Tap to read natively
												</div>
											</div>
											<span className="text-[10px] font-semibold text-[#a78bfa] shrink-0">
												{isPdfDoc(doc) ? 'PDF' : isMarkdownDoc(doc) ? 'MD' : 'Read'}
											</span>
										</button>
									))
								)}
							</div>
						)}

						{tab === 'media' && (
							<div className="grid grid-cols-2 gap-2">
								{media.length === 0 ? (
									<p className="col-span-2 text-xs text-zinc-500 text-center py-8">No media shared yet.</p>
								) : (
									media.map((item) => {
										const safeUrl = safeMediaUrl(item.url)
										if (!safeUrl) return null
										if (item.kind === 'audio') {
											return (
												<div
													key={item.id}
													className="col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 space-y-1.5"
												>
													<div className="flex items-center justify-between gap-2 text-[11px]">
														<span className="font-medium text-zinc-200 truncate">{item.filename}</span>
														<span className="text-[10px] text-[#a78bfa] shrink-0">Audio</span>
													</div>
													<audio src={safeUrl} controls preload="metadata" className="w-full h-8" />
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
													className="aspect-square rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/25 transition relative bg-black flex items-center justify-center group"
												>
													<video src={safeUrl} muted playsInline className="w-full h-full object-cover opacity-80" />
													<div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition">
														<span className="w-9 h-9 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white">
															<svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
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
												className="aspect-square rounded-xl overflow-hidden border border-white/[0.08] hover:border-[#8b5cf6]/50 transition block cursor-pointer"
											>
												<img src={safeUrl} alt={item.filename} className="w-full h-full object-cover" />
											</button>
										)
									})
								)}
							</div>
						)}

						{tab === 'links' && (
							<div className="space-y-2">
								{links.length === 0 ? (
									<p className="text-xs text-zinc-500 text-center py-8">No links collected yet.</p>
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
												className="block rounded-xl border border-white/[0.07] hover:border-white/20 bg-white/[0.02] p-3 transition"
											>
												<div className="text-xs font-medium text-[#a78bfa] truncate">{safeLink}</div>
												<div className="text-[10px] text-zinc-500 mt-1">{l.createdAt}</div>
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
					className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col p-4 sm:p-6"
				>
					<div
						onClick={(e) => e.stopPropagation()}
						className="flex items-center justify-between gap-3 pb-3 border-b border-white/10"
					>
						<div className="min-w-0">
							<div className="text-sm font-semibold text-white truncate">{lightboxImage.filename}</div>
							<div className="text-xs text-zinc-400">
								{(lightboxImage.sizeBytes / 1024).toFixed(1)} KB &bull; {lightboxImage.createdAt}
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<a
								href={safeMediaUrl(lightboxImage.url) ?? undefined}
								download={lightboxImage.filename}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
								</svg>
								<span>Download</span>
							</a>
							<button
								type="button"
								onClick={() => setLightboxImage(null)}
								aria-label="Close lightbox"
								className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition cursor-pointer"
							>
								<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
								<span>Close</span>
							</button>
						</div>
					</div>
					<div className="flex-1 flex items-center justify-center overflow-hidden pt-4">
						<img
							src={lightboxImage.url}
							alt={lightboxImage.filename}
							onClick={(e) => e.stopPropagation()}
							className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
						/>
					</div>
				</div>
			)}
		</aside>
	)
}
