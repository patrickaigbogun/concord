/**
 * Controlled haptic feedback for Concord interactions.
 * Native WebView selection/context-menu haptics are disabled via CSS & contextmenu prevention
 * so haptics only fire intentionally on Concord actions.
 */
function vibrate(pattern: number | number[]): void {
	if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		try {
			navigator.vibrate(pattern)
		} catch {
			// Ignore if blocked by browser policy
		}
	}
}

export function hapticTap(): void {
	vibrate(8)
}

export function hapticReply(): void {
	vibrate([12, 24, 10])
}

export function hapticMenu(): void {
	vibrate(18)
}
