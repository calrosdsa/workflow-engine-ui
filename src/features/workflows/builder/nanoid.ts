// Tiny collision-resistant ID generator — avoids adding a dependency.
export function nanoid(len = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  arr.forEach((b) => (id += chars[b % chars.length]))
  return id
}
