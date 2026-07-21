/** Same-origin `/api` is proxied to Express via next.config rewrites. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";