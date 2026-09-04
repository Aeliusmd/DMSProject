import { ApiRequestError } from "@/lib/auth/authApi";
import { isNetworkError, NETWORK_UNAVAILABLE_MESSAGE } from "@/lib/networkErrors";

const DEFAULT_LABEL = "document";

/**
 * User-facing message when a PDF/document cannot be opened for viewing.
 */
export function getDocumentOpenErrorMessage(
  error,
  documentLabel = DEFAULT_LABEL
) {
  const label = String(documentLabel || DEFAULT_LABEL).trim() || DEFAULT_LABEL;

  if (isNetworkError(error)) {
    return NETWORK_UNAVAILABLE_MESSAGE;
  }

  const status = Number(error?.status || error?.statusCode || 0);
  const raw = String(error?.message || "").trim();
  const lower = raw.toLowerCase();

  if (status === 401) {
    return "Your session expired. Please sign in again to view this file.";
  }

  if (status === 403) {
    return `You do not have permission to view this ${label}.`;
  }

  if (status === 404 || /not found|missing|does not exist|enoent/.test(lower)) {
    return `This ${label} could not be opened. The file may have been moved or deleted.`;
  }

  if (status === 413 || /too large/.test(lower)) {
    return `This ${label} is too large to open in the browser. Try downloading it instead.`;
  }

  if (status >= 500) {
    return `Unable to open this ${label} right now. Please try again.`;
  }

  if (
    raw &&
    !["validation failed", "invalid data", "request failed", "failed to fetch"].includes(
      lower
    )
  ) {
    return raw;
  }

  return `Unable to open this ${label}. Please try again or download the file.`;
}

/**
 * Parse JSON error body from a failed file/PDF response.
 */
export async function readFileResponseErrorMessage(
  response,
  fallback = "Unable to open this document."
) {
  if (!response) return fallback;

  try {
    const body = await response.json();
    if (body?.message) return String(body.message);
  } catch {
    // Non-JSON bodies (HTML, empty) — fall through to status mapping.
  }

  return getDocumentOpenErrorMessage(
    new ApiRequestError(fallback, response.status),
    "document"
  );
}

/**
 * Ensure a fetched blob is a real file we can open (not empty / JSON error).
 */
export async function assertOpenableDocumentBlob(
  blob,
  documentLabel = DEFAULT_LABEL
) {
  const label = String(documentLabel || DEFAULT_LABEL).trim() || DEFAULT_LABEL;

  if (!blob || !(blob instanceof Blob)) {
    throw new ApiRequestError(
      `This ${label} could not be opened. No file was returned.`,
      404
    );
  }

  if (blob.size === 0) {
    throw new ApiRequestError(
      `This ${label} could not be opened. The file is missing or empty.`,
      404
    );
  }

  const type = String(blob.type || "").toLowerCase();
  if (type.includes("application/json") || type.includes("text/json")) {
    try {
      const text = await blob.text();
      const body = JSON.parse(text);
      throw new ApiRequestError(
        body?.message ||
          `This ${label} could not be opened. The file may have been moved or deleted.`,
        404
      );
    } catch (err) {
      if (err instanceof ApiRequestError) throw err;
      throw new ApiRequestError(
        `This ${label} could not be opened. The file may have been moved or deleted.`,
        404
      );
    }
  }

  return blob;
}
