import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { runtimeRouter } from '@/runtime-router'

interface RuntimeLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
}

// TanStack Router's <Link> route-string typing is pinned to the single
// GLOBAL `Register.router` type (router.tsx's builder tree — see the note
// in runtime-router.tsx explaining why a second, conflicting Register
// declaration for runtimeRouter isn't viable). Rather than fighting that
// per call site, every runtime nav link goes through this one component:
// a plain <a> for correct href/right-click/open-in-new-tab semantics, with
// runtimeRouter.navigate() intercepting a plain left-click for client-side
// (no full reload) navigation — the same UX Link provides, just without
// compile-time route-string checking (acceptable here since these are
// simple, fully-controlled template strings, not user input).
export function RuntimeLink({ to, onClick, children, ...rest }: RuntimeLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks (ctrl/cmd/middle-click "open in new tab") fall
    // through to native <a> behavior instead of intercepting them.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    // navigate({to}) treats `to` as a literal path — a `?query` embedded in
    // it is NOT auto-split the way a real URL would be, so it must be
    // parsed out and passed as the separate `search` option.
    const [pathname, queryString] = to.split('?')
    const search = queryString
      ? Object.fromEntries(new URLSearchParams(queryString))
      : undefined
    runtimeRouter.navigate({ to: pathname, search })
    onClick?.(e)
  }

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
