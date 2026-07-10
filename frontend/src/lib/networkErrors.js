export const NETWORK_UNAVAILABLE_MESSAGE =
  "The system is temporarily unavailable. Please try again later.";

const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|load failed|network request failed/i;

/**
 * True when fetch could not reach the API (backend down, offline, CORS, etc.).
 */
export function isNetworkError(error) {
  if (!error) return false;

  if (error.status === 0) {
    return true;
  }

  if (
    error.name === "TypeError" &&
    NETWORK_ERROR_PATTERN.test(`${error.message || ""}`)
  ) {
    return true;
  }

  return false;
}
