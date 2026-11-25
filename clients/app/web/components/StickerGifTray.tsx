import { useState } from 'react'
import type { FileAsset } from '../../lib/types'

interface StickerGifTrayProps {
	spaceId: string
	onClose: () => void
	onSendSticker: (sticker: string) => void
	onSendGif: (asset: FileAsset) => void
}

type TrayMode = 'stickers' | 'gifs'

const STICKER_PACK = [
	{ symbol: '🔥', label: 'Fire' },
	{ symbol: '✨', label: 'Sparkle' },
	{ symbol: '💜', label: 'Heart' },
	{ symbol: '😂', label: 'Laugh' },
	{ symbol: '😭', label: 'Crying' },
	{ symbol: '🫡', label: 'Salute' },
	{ symbol: '🤝', label: 'Deal' },
	{ symbol: '👏', label: 'Clap' },
	{ symbol: '👀', label: 'Eyes' },
	{ symbol: '💯', label: '100' },
	{ symbol: '⚡', label: 'Bolt' },
	{ symbol: '🌙', label: 'Night' },
	{ symbol: '🎵', label: 'Music' },
	{ symbol: '🫶', label: 'Hands' },
	{ symbol: '🚀', label: 'Launch' },
	{ symbol: '🕊️', label: 'Peace' },
]

const CURATED_GIFS = [
	{
		id: 'gif-nod',
		title: 'Respect Nod',
		tags: 'nod yes agree respect',
		url: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif',
	},
	{
		id: 'gif-clap',
		title: 'Standing Ovation',
		tags: 'clap applause bravo congrats',
		url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif',
	},
	{
		id: 'gif-fire',
		title: 'Pure Fire',
		tags: 'fire lit awesome wow',
		url: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif',
	},
	{
		id: 'gif-laugh',
		title: 'Dying Laughing',
		tags: 'laugh funny lol haha',
		url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
	},
	{
		id: 'gif-mindblown',
		title: 'Mind Blown',
		tags: 'wow mind blown shocked',
		url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
	},
	{
		id: 'gif-vibe',
		title: 'Vibing',
		tags: 'vibe music dance chill',
		url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
	},
	{
		id: 'gif-typing',
		title: 'Cooking',
		tags: 'typing coding working fast',
		url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
	},
	{
		id: 'gif-peace',
		title: 'Peace Out',
		tags: 'bye peace out leave',
		url: 'https://media.giphy.com/media/Ru9sjtZ09XOEg/giphy.gif',
	},
]

export function StickerGifTray({
	spaceId,
	onClose,
	onSendSticker,
	onSendGif,
}: StickerGifTrayProps) {
	const [mode, setMode] = useState<TrayMode>('stickers')
	const [query, setQuery] = useState('')

	const filteredGifs = query.trim()
		? CURATED_GIFS.filter((g) => {
				const q = query.trim().toLowerCase()
				return g.title.toLowerCase().includes(q) || g.tags.includes(q)
			})
		: CURATED_GIFS

	return (
		<div
			data-no-pane-swipe="true"
			className="bg-[#221d19] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] select-none"
		>
			{/* Top Bar: Stickers | GIFs switch + Close */}
			<div className="flex items-center justify-between gap-3 mb-3">
				<div className="flex items-center gap-1.5 bg-[#191922] p-1 rounded-2xl">
					<button
						type="button"
						onClick={() => setMode('stickers')}
						className={`px-4 py-1.5 rounded-xl text-[14px] font-semibold transition cursor-pointer ${
							mode === 'stickers' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'
						}`}
					>
						Stickers
					</button>
					<button
						type="button"
						onClick={() => setMode('gifs')}
						className={`px-4 py-1.5 rounded-xl text-[14px] font-semibold transition cursor-pointer ${
							mode === 'gifs' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'
						}`}
					>
						GIFs
					</button>
				</div>

				<button
					type="button"
					onClick={onClose}
					aria-label="Close stickers and GIFs"
					className="w-9 h-9 rounded-full bg-[#191922] hover:bg-[#23232f] text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer"
				>
					<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
						<path d="M18 6L6 18" />
						<path d="M6 6l12 12" />
					</svg>
				</button>
			</div>

			{mode === 'stickers' && (
				<div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-56 overflow-y-auto no-scrollbar">
					{STICKER_PACK.map((item) => (
						<button
							key={item.label}
							type="button"
							title={item.label}
							onClick={() => {
								onSendSticker(item.symbol)
								onClose()
							}}
							className="aspect-square rounded-2xl bg-[#181820] hover:bg-[#242432] active:scale-95 flex items-center justify-center text-3xl transition cursor-pointer"
						>
							{item.symbol}
						</button>
					))}
				</div>
			)}

			{mode === 'gifs' && (
				<div className="space-y-3">
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Filter GIFs (fire, laugh, vibe, clap…)"
						className="w-full rounded-2xl bg-[#181820] px-4 py-2.5 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/50"
					/>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto no-scrollbar">
						{filteredGifs.map((gif) => (
							<button
								key={gif.id}
								type="button"
								onClick={() => {
									onSendGif({
										id: `gif-${Date.now()}`,
										spaceId,
										filename: `${gif.title}.gif`,
										contentType: 'image/gif',
										sizeBytes: 0,
										url: gif.url,
										kind: 'image',
										createdAt: 'Just now',
									})
									onClose()
								}}
								className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#181820] group cursor-pointer"
							>
								<img
									src={gif.url}
									alt={gif.title}
									loading="lazy"
									className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
								/>
								<span className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">
									{gif.title}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
