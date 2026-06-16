const ApiError = require("../utils/ApiError");
const config = require("../config");

/**
 * Forward a PDF to the Subpoena_Extraction FastAPI service (POST /process).
 * Does not modify the Python service — HTTP client only.
 */
async function processDocument(fileBuffer, originalFileName) {
  const url = config.subpoenaExtraction.apiUrl;
  if (!url) {
    throw new ApiError(
      503,
      "Subpoena extraction service is not configured (SUBPOENA_EXTRACTION_API_URL)"
    );
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new ApiError(400, "Uploaded file is empty");
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, originalFileName || "upload.pdf");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(config.subpoenaExtraction.timeoutMs),
    });
  } catch (err) {
    const detail =
      err.name === "TimeoutError"
        ? "Subpoena extraction service timed out"
        : `Subpoena extraction service unreachable: ${err.message}`;
    throw new ApiError(503, detail);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      502,
      `Subpoena extraction service returned invalid JSON (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : body.message || "Subpoena extraction failed";
    throw new ApiError(response.status >= 500 ? 502 : 400, detail);
  }

  return body;
}

module.exports = {
  processDocument,
};
