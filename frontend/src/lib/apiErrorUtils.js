import { ApiRequestError } from "@/lib/auth/authApi";
import { isNetworkError, NETWORK_UNAVAILABLE_MESSAGE } from "@/lib/networkErrors";

export { isNetworkError, NETWORK_UNAVAILABLE_MESSAGE };

const GENERIC_MESSAGES = new Set([
  "validation failed",
  "invalid data",
  "request failed",
]);

/**
 * Map backend `{ field, message }[]` to a flat `{ [field]: message }` object.
 */
export function mapApiErrors(errors = [], fieldMap = {}) {
  const mapped = {};

  if (!Array.isArray(errors)) {
    return mapped;
  }

  errors.forEach(({ field, message }) => {
    if (!field) return;
    const key = fieldMap[field] || field;
    mapped[key] = message;
  });

  return mapped;
}

/**
 * Hide generic banner text when field-level errors are already shown.
 */
export function shouldShowSubmitError(message, fieldErrors = {}) {
  const normalized = `${message || ""}`.trim().toLowerCase();
  if (!normalized) return false;

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  if (hasFieldErrors && GENERIC_MESSAGES.has(normalized)) {
    return false;
  }

  return !Object.values(fieldErrors).some(
    (value) => `${value || ""}`.trim().toLowerCase() === normalized
  );
}

/**
 * Prefer the first field message when the API message is generic.
 */
export function getApiErrorMessage(error, fallback = "Request failed") {
  if (isNetworkError(error)) {
    return NETWORK_UNAVAILABLE_MESSAGE;
  }

  if (!(error instanceof ApiRequestError)) {
    return error?.message || fallback;
  }

  const firstFieldMessage = error.errors?.find((item) => item?.message)?.message;

  if (firstFieldMessage) {
    const normalized = `${error.message || ""}`.trim().toLowerCase();
    if (GENERIC_MESSAGES.has(normalized)) {
      return firstFieldMessage;
    }
  }

  return error.message || firstFieldMessage || fallback;
}

/**
 * Parse an API error into field errors and an optional banner message.
 */
export function applyApiFieldErrors(error, fieldMap = {}) {
  if (!(error instanceof ApiRequestError) || !error.errors?.length) {
    return {
      fieldErrors: {},
      message: getApiErrorMessage(error),
    };
  }

  const fieldErrors = mapApiErrors(error.errors, fieldMap);
  const message = shouldShowSubmitError(error.message, fieldErrors)
    ? error.message
    : "";

  return { fieldErrors, message };
}

/**
 * Merge API field errors into a React state setter.
 * Returns the banner message to display (if any).
 */
export function mergeApiFieldErrors(error, setFieldErrors, options = {}) {
  const { fieldMap = {}, merge = true } = options;
  const { fieldErrors, message } = applyApiFieldErrors(error, fieldMap);

  if (Object.keys(fieldErrors).length > 0) {
    setFieldErrors((prev) => (merge ? { ...prev, ...fieldErrors } : fieldErrors));
  }

  return message || getApiErrorMessage(error);
}

export function hasValidationErrors(validationErrors = {}) {
  return Object.keys(validationErrors).length > 0;
}
