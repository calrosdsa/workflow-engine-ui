/** Served by the runtime.html bundle at this app's client-scoped root. Used
 *  for full cross-bundle navigations (window.location, not the builder
 *  router's navigate) from both the builder (Home, ApplicationDesignShell)
 *  and the runtime bundle itself (designHub's reverse direction). */
export function runtimeUrlFor(clientId: string, appId: string): string {
  return `/${clientId}/${appId}`
}
