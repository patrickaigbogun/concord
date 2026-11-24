import { useState } from 'react'
import type { RealmNote } from '../../lib/types'

interface RealmNoteBarProps {
	note?: RealmNote
}

export function RealmNoteBar({ note }: RealmNoteBarProps) {
	const [playing, setPlaying] = useState(false)

	if (!note) return null

	return (
		<div className="px-4 py-2 bg-[#111116]/90 border-b border-white/[0.06] flex items-center justify-between gap-3">
			<div className="flex items-center gap-2.5 min-w-0">
				<span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-[#a78bfa] bg-[#8b5cf6]/15 px-2 py-0.5 rounded-full">
					Note
				</span>
				<p className="text-xs text-zinc-300 truncate font-editorial italic">
					“{note.text}”
				</p>
			</div>

			{note.audioTitle ? (
				<button
					type="button"
					onClick={() => setPlaying((p) => !p)}
					className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition cursor-pointer ${
						playing
							? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 text-[#c4b5fd]'
							: 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
					}`}
				>
					<span>{playing ? '❚❚' : '▶'}</span>
					<span className="max-w-[120px] truncate">{note.audioTitle}</span>
				</button>
			) : (
				<span className="shrink-0 text-[10px] text-zinc-500">{note.updatedAt}</span>
			)}
		</div>
	)
}
