import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Enter/Space → the same action a click already triggers, for a non-native
 * interactive element (a div/span carrying role="button"/"group" + tabIndex
 * + onClick — a real <button> gets this from the browser for free).
 *
 * Only fires when the key event's own target IS the element the handler is
 * bound to (`e.target === e.currentTarget`) — a keydown on a focused NESTED
 * real control (a drag-handle button, a delete button, an input) bubbles up
 * through this element too, and would otherwise double-fire this action
 * on top of whatever that descendant's own Enter/Space handling already
 * does. This mirrors the `e.stopPropagation()` these same elements' onClick
 * already needs for the identical reason on the mouse side.
 */
export function onKeyboardActivate<T extends HTMLElement>(
  action: (e: React.KeyboardEvent<T>) => void,
) {
  return (e: React.KeyboardEvent<T>) => {
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    action(e)
  }
}
