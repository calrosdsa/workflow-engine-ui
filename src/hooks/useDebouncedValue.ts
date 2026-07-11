import { useEffect, useState } from 'react'

/** Returns `value`, but delayed so it only updates after `delayMs` of no
 *  further changes — for debouncing search inputs before firing a query. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
