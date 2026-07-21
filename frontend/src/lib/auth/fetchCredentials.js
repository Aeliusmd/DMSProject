export const CREDENTIALS_INCLUDE = { credentials: "include" };

export function withCredentials(options = {}) {
  return {
    ...options,
    credentials: "include",
  };
}
