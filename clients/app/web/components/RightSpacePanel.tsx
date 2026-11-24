import { useState } from 'react'
import type { FileAsset, SeriesPost, Space } from '../../lib/types'

interface RightSpacePanelProps {
	space: Space
	posts: SeriesPost[]
	files: FileAsset[]
	onCloseMobile?: () => void
}

type HubTab = 'series' | 'docs' | 'media' | 'links'

export function RightSpacePanel({ space, posts, files, onCloseMobile }: RightSpacePanelProps) {
	const [tab, setTab] = useState<HubTab>('series')
	const [openDoc, setOpenDoc] = useState<FileAsset | null>(null)
	const [openPost, setOpenPost] = useState<SeriesPost | null>(null)

	const docs = files.filter((f) => f.kind === 'doc')
	const media = files.filter((f) => f.kind === 'image' || f.kind === 'video')
	const links = files.filter((f) => f.kind === 'link')

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
				{onCloseMobile && (
					<button
						type="button"
						onClick={onCloseMobile}
						className="lg:hidden text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-white/[0.05] cursor-pointer"
					>
						Back
					</button>
				)}
			</div>

			{/* Mega-Hub Tabs */}
			<div className="px-3 pt-3 pb-2">
				<div className="grid grid-cols-4 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
					{([
						['series', 'Series'],
						['docs', 'Docs'],
						['media', 'Media'],
						['links', 'Links'],
					] as [HubTab, string][]).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								setTab(key)
								setOpenDoc(null)
								setOpenPost(null)
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
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => setOpenPost(null)}
							className="text-xs text-[#a78bfa] hover:underline cursor-pointer"
						>
							All issues
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
							<div className="pt-2 border-t border-white/[0.06] text-sm font-editorial text-zinc-200 leading-relaxed whitespace-pre-wrap">
								{openPost.body}
							</div>
						</article>
					</div>
				) : openDoc ? (
					/* Native Document Viewer */
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={() => setOpenDoc(null)}
								className="text-xs text-[#a78bfa] hover:underline cursor-pointer"
							>
								All docs
							</button>
							<a
								href={openDoc.url}
								target="_blank"
								rel="noreferrer"
								className="text-[11px] text-zinc-400 hover:text-white"
							>
								Open raw
							</a>
						</div>
						<div className="rounded-2xl border border-white/[0.08] bg-[#121217] p-4 space-y-2.5">
							<div className="text-xs font-semibold text-white">{openDoc.filename}</div>
							<div className="text-[10px] text-zinc-500">
								{openDoc.contentType} &bull; {(openDoc.sizeBytes / 1024).toFixed(1)} KB
							</div>
							<pre className="pt-3 border-t border-white/[0.06] text-xs text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
								{openDoc.previewText || 'Preview available when opened directly from R2.'}
							</pre>
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
											onClick={() => setOpenPost(post)}
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
												<span>{post.echoCount} echos</span>
												<span>{post.commentCount} comments</span>
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
											<span className="text-[10px] font-semibold text-[#a78bfa] shrink-0">Read</span>
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
									media.map((item) => (
										<a
											key={item.id}
											href={item.url}
											target="_blank"
											rel="noreferrer"
											className="aspect-square rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/25 transition block"
										>
											<img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
										</a>
									))
								)}
							</div>
						)}

						{tab === 'links' && (
							<div className="space-y-2">
								{links.length === 0 ? (
									<p className="text-xs text-zinc-500 text-center py-8">No links collected yet.</p>
								) : (
									links.map((l) => (
										<a
											key={l.id}
											href={l.url}
											target="_blank"
											rel="noreferrer"
											className="block rounded-xl border border-white/[0.07] hover:border-white/20 bg-white/[0.02] p-3 transition"
										>
											<div className="text-xs font-medium text-[#a78bfa] truncate">{l.url}</div>
											<div className="text-[10px] text-zinc-500 mt-1">{l.createdAt}</div>
										</a>
									))
								)}
							</div>
						)}
					</>
				)}
			</div>
		</aside>
	)
}
