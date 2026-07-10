# DMS Backend — Validation, Sanitization, SQL Safety & Exception Handling

This document summarizes how the DMS API protects input, queries, and errors **by module**. It covers what was already in place and what was added to strengthen backend validation (so frontend-only checks are not relied on alone).

---

## Architecture overview

Every API request passes through these layers:

```
Request
  → Auth / role middleware (where required)
  → Upload middleware (file routes)
  → Controller validation (validators)
  → Service business rules + sanitization
  → Model (parameterized SQL)
  → asyncHandler catches async errors
  → errorHandler + errorMapper → JSON response
```

### Standard error response (frontend)

All handled API errors return:

```json
{
  "success": false,
  "message": "Human-readable message",
  "errors": [{ "field": "email", "message": "Enter a valid email address" }]
}
```

- `errors` is an array for validation failures, or `null` for general errors.
- Stack traces are **never** sent to the client.
- Unknown 500 errors return `"Internal server error"`.

The frontend `request()` helper in `frontend/src/lib/auth/authApi.js` maps this to:

```js
throw new ApiRequestError(data.message, response.status, data.errors);
```

---

## Shared infrastructure

| File | Purpose |
|------|---------|
| `src/validators/validationHelpers.js` | Email, ISO date, money, SSN, positive IDs, max length |
| `src/validators/*.js` | Per-domain request validators |
| `src/utils/validationUtils.js` | `throwIfInvalid()` → `ApiError(400, "Validation failed", errors)` |
| `src/lib/facilityValidation.js` | Facility & doctor payload rules (used by `facilityValidator`) |
| `src/lib/reportQueryParser.js` | Report query validation + sanitization |
| `src/utils/sanitize.js` | Strip control chars, bound text/search length, `escapeHtml`, `sanitizeTrimOrNull` |
| `src/utils/sqlSafety.js` | `escapeLike`, `likeContains`, `assertPositiveInt`, `assertIsoDate`, `assertEnum` |
| `src/utils/fieldLimits.js` | Column-aligned max lengths |
| `src/utils/asyncHandler.js` | Wraps controllers; `runSideEffect` / `runSafely` for background work |
| `src/utils/errorMapper.js` | Maps DB, JWT, Stripe, FS, JSON errors → `ApiError` |
| `src/middleware/errorHandler.js` | Global Express error middleware |
| `src/middleware/uploadMiddleware.js` | MIME allowlists, file size limits, safe filenames |
| `src/app.js` | `express.json({ limit: "2mb" })`, global `errorHandler` |
| `server.js` | `unhandledRejection` / `uncaughtException` logging |

### Validator pattern

```js
{ valid: boolean, errors?: [{ field: string, message: string }] }
```

Controllers call validators **before** services. Services keep existing business-rule checks (no logic removed).

---

## Module summary

### Auth (`/api/auth`)

| Area | Implementation |
|------|----------------|
| **Validation** | `authValidator.js` — login, 2FA, resend 2FA, refresh, logout |
| **Sanitization** | Trim + format checks on identifier/email/password/token fields |
| **SQL injection** | Parameterized queries in `AuthSession`, `Employee` models |
| **Exceptions** | `ApiError` for invalid credentials; JWT errors mapped in `errorMapper` (`TokenExpiredError`, `JsonWebTokenError`, `NotBeforeError`) |

---

### Employees (`/api/employees`)

| Area | Implementation |
|------|----------------|
| **Validation** | `employeeValidator.js` — create, update, **suspend** (reactivation datetime, must be future) |
| **Query validation** | `validateMilestoneStatsQuery` — optional ISO `from` / `to` |
| **Sanitization** | `sanitizeSearchText` on employee list search in service |
| **SQL injection** | `Employee` model uses `:named` params + `escapeLikePrefix` for search |
| **Exceptions** | `ApiError` for duplicate email, self-suspend, admin suspend, etc. |

---

### Orders (`/api/orders`)

| Area | Implementation |
|------|----------------|
| **Validation** | `orderValidator.js` — create, update, facility update, notes, workflow stages |
| **Action validation** | `orderActionValidator.js` — cancel, mail/CNR/certificate emails, copy letter, pickup, fax, batch scan, medical record upload (`recordType` enum) |
| **Query validation** | `validateOrderNotesQuery` (dates, pageSize 1–100, noteId); `validateSearchQuery` on doctor/address search |
| **Sanitization** | `sanitizeSearchText` on order list filters; `sanitizeText` on notes/text fields in service |
| **SQL injection** | `Order` model — parameterized queries; `sortDir` whitelisted (`asc`/`desc` only); `LIKE` via escaped patterns |
| **Upload** | PDF-only medical records; batch scan PDF; multer size limits |
| **Exceptions** | Business rules in `orderService` (not found, already cancelled, CNR flags, etc.) → `ApiError` |

**Validated endpoints (controller layer):**

- `POST /` create, `PUT /:id` update, `PATCH /:id/facility`
- `POST/PUT …/notes`, `GET …/notes` (query), `PATCH …/workflow-stages`
- `POST /:id/cancel`, `mail`, `send-cnr-record`, `send-certificate-of-records`, `send-copy-letter`, `pickup`, `fax`
- `POST /batch-scan`, `POST /:id/scan-medical-records`
- Doctor/address search queries

---

### Invoices (`/api/invoices`)

| Area | Implementation |
|------|----------------|
| **Validation** | `invoiceValidator.js` — create/update, X-ray invoice, invoice/order ID arrays, recipient emails, write-off payloads |
| **Sanitization** | `sanitizeTrimOrNull` on text fields in `invoiceService` |
| **SQL injection** | `Invoice`, `InvoiceXray`, `InvoiceReport` — parameterized queries; report `ORDER BY` from internal constants only |
| **Exceptions** | `throwIfInvalid` in controller; service throws for not found, already paid, zero total |

---

### Facilities (`/api/facilities`)

| Area | Implementation |
|------|----------------|
| **Validation** | `facilityValidator.js` wraps `facilityValidation.js` — create, update, resolve (name required), doctors create/update, notes, document upload (type enum + file required) |
| **Sanitization** | `sanitizeSearchText` on facility search; service-layer validation retained |
| **SQL injection** | `Facility`, `FacilityDoctor`, `OfficeManager` — `:named` params + `escapeLikePrefix` |
| **Upload** | Facility documents — MIME/size via `uploadMiddleware` |
| **Exceptions** | Duplicate facility, not found, invalid doctor — `ApiError` |

**Sub-routes:**

- **Notes** (`facilityNoteController`) — `validateFacilityNote` (required, max 500 chars)
- **Documents** (`facilityDocumentController`) — `validateDocumentUpload` (file + `Standard|Legal|Medical|Financial|Other`)

---

### Providers (`/api/providers`)

| Area | Implementation |
|------|----------------|
| **Validation** | `providerValidator.js` — update (company name, email, zip, state, phone/fax formats, max lengths) |
| **Query validation** | `validateSearchQuery` on search |
| **Sanitization** | **Added:** `sanitizeSearchText` + `stripControlCharacters` on provider text fields in `providerService.buildProviderPayload` |
| **SQL injection** | `Provider.search` uses `likeContains` + `assertPositiveInt` for limit |
| **Exceptions** | Not found, invalid id, missing company name |

---

### Payments (`/api/payments`)

| Area | Implementation |
|------|----------------|
| **Validation** | `paymentValidator.js` — manual payment (orderId, invoiceType, check number, payment date) |
| **Query validation** | `validatePaymentSearchQuery` — order search ref required, max length |
| **Sanitization** | `sanitizeTrimOrNull` on payment notes in service |
| **SQL injection** | Parameterized updates/inserts in `paymentService` |
| **Exceptions** | Invoice not found, already paid, invalid date — `ApiError` |

---

### Settings (`/api/settings`)

| Area | Implementation |
|------|----------------|
| **Validation** | `settingsValidator.js` — profile (name, email), password change, notification booleans |
| **Sanitization** | Trim on profile fields in service |
| **SQL injection** | `Employee`, `EmployeeSettings` parameterized |
| **Exceptions** | Email in use (409), wrong current password, validation field errors |

---

### Notifications (`/api/notifications`)

| Area | Implementation |
|------|----------------|
| **Validation** | `validateNotificationQuery` — `limit` capped 1–100 |
| **Sanitization** | `sanitizeSearchText` on optional search in service |
| **SQL injection** | `Notification` model parameterized |
| **Exceptions** | Not found when marking read — `ApiError` |

---

### Reports (`/api/reports`)

| Area | Implementation |
|------|----------------|
| **Validation** | `reportQueryParser.js` — date ranges, page size (max 100), cursor length, rush levels, activity filters, company group key |
| **Sanitization** | `sanitizeSearchText` on search, orderNo, caseNumber, doctor fields |
| **SQL injection** | Report models use bound parameters; enums whitelisted |
| **Exceptions** | Invalid date range, invalid cursor — `ApiError` |

---

### Dashboard (`/api/dashboard`)

| Area | Implementation |
|------|----------------|
| **Validation** | `limit` clamped 1–20 in `dashboardService` |
| **SQL injection** | Static SQL with parameterized filters |
| **Exceptions** | DB errors via `errorMapper` |

---

### Activity log (`/api/activity-log`)

| Area | Implementation |
|------|----------------|
| **Validation** | `queryLogs` parsing in `activityLogService` (dates, module, pagination) |
| **Sanitization** | `sanitizeSearchText` on search filter |
| **SQL injection** | `ActivityLog` parameterized + `escapeLike` for search |
| **Exceptions** | Access restrictions by role — `ApiError` |

---

### Stripe public (`/api/public/pay`)

| Area | Implementation |
|------|----------------|
| **Validation** | `stripeValidator.js` — checkout `invoiceType` (`regular` \| `xray`); `validateStripeCheckoutResult` — `session_id` required |
| **Exceptions** | Stripe errors (`error.type` starts with `Stripe`) mapped in `errorMapper`; invalid/expired token — `ApiError` |

---

### Stripe webhook (`/api/webhooks/stripe`)

| Area | Implementation |
|------|----------------|
| **Validation** | Signature verification in `stripePaymentService` |
| **Exceptions** | `Webhook signature verification failed` → 400; wrapped in `asyncHandler` |

---

### Public record download (`/api/public`)

| Area | Implementation |
|------|----------------|
| **Validation** | Token validation in `recordDownloadService` |
| **Exceptions** | Expired/invalid token — `ApiError` |

---

## SQL injection protection (global)

| Technique | Where |
|-----------|--------|
| **Named parameters** (`:orderId`, `:query`, etc.) | All models via `mysql2` `pool.execute()` |
| **LIKE escaping** | `sqlSafety.escapeLike`, `likeContains`, model `escapeLikePrefix` |
| **Integer limits** | `assertPositiveInt` on LIMIT values |
| **Sort whitelist** | Order list: only `asc` / `desc` for `sortDir` |
| **Enum whitelist** | Reports, rush levels, document types, record types, invoice types |
| **No user SQL fragments** | Dynamic SQL builds `WHERE` from fixed condition templates + bound params |

---

## Data sanitization (global)

| Function | Use |
|----------|-----|
| `stripControlCharacters` | Remove null bytes and control chars |
| `sanitizeText` | Trim + max length before storage |
| `sanitizeSearchText` | Query/search strings (default max 200 chars) |
| `sanitizeTrimOrNull` | Optional text fields in payments/invoices |
| `escapeHtml` | Email templates / HTML output |
| `fieldLimits.js` | Aligns with DB column sizes |

---

## Exception handling reference

### Custom

| Name | Handling |
|------|----------|
| `ApiError` | Passed through `errorHandler`; returns `message` + optional `errors` |

### Upload

| Name | Client message |
|------|----------------|
| `MulterError` | File upload error |
| `MulterError` code `LIMIT_FILE_SIZE` | Uploaded file exceeds limit |
| Message `"Unsupported file type"` | Same text (400) |

### JSON / Express

| Name | Client message |
|------|----------------|
| `SyntaxError` (`entity.parse.failed`) | Invalid JSON in request body |

### JWT

| Name | Client message |
|------|----------------|
| `TokenExpiredError` | Session expired. Please sign in again. |
| `JsonWebTokenError` | Invalid or expired session. Please sign in again. |
| `NotBeforeError` | Invalid or expired session. Please sign in again. |

### MySQL (`error.code`)

| Code | Status | Client message |
|------|--------|----------------|
| `ER_DUP_ENTRY` | 409 | This record already exists. |
| `ER_NO_REFERENCED_ROW_2` | 400 | A related record was not found. |
| `ER_ROW_IS_REFERENCED_2` | 400 | This record is in use and cannot be removed. |
| `ER_BAD_NULL_ERROR` | 400 | A required field is missing. |
| `ER_DATA_TOO_LONG` | 400 | One or more fields exceed the allowed length. |
| `ER_TRUNCATED_WRONG_VALUE` | 400 | One or more fields contain an invalid value. |
| `ER_PARSE_ERROR` | 400 | Invalid data was submitted. |
| `ER_LOCK_WAIT_TIMEOUT` | 503 | The request timed out. Please try again. |
| `ER_LOCK_DEADLOCK` | 503 | The request conflicted with another update. Please try again. |
| `ER_ACCESS_DENIED_ERROR` | 503 | Database is temporarily unavailable. |
| Other `ER_*` | 400 | Database request could not be completed. |

### Network / DB connection

`ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `EHOSTUNREACH`, `ENOTFOUND`, `PROTOCOL_CONNECTION_LOST` → **503** Database is temporarily unavailable.

### File system

| Code | Status | Message |
|------|--------|---------|
| `ENOENT` | 404 | The requested file was not found. |
| `EACCES` / `EPERM` | 403 | File access was denied. |
| `ENOSPC` | 507 | Server storage is full. |

### Stripe

Any error with `type` starting with `Stripe` → mapped to `ApiError` with Stripe message.

### Process-level (server only, not sent to client)

| Event | Action |
|-------|--------|
| `unhandledRejection` | Logged in `server.js` |
| `uncaughtException` | Logged in `server.js` |

### Fallback

Unknown errors → **500** `"Internal server error"` (logged with stack server-side).

---

## Frontend integration notes

| Screen / area | Field-level `errors[]` | Banner `message` only |
|---------------|------------------------|------------------------|
| Employee form | Yes | — |
| Settings profile/password | Yes | — |
| Facility create/edit/doctors | Yes | — |
| Orders, lists, many modals | Partial | Yes |

All API clients receive `message` and `errors` via `ApiRequestError`. Per-field UI mapping depends on each page implementing `error.errors`.

---

## Files added or extended (validation hardening)

### New validator files

- `src/validators/providerValidator.js`
- `src/validators/settingsValidator.js`
- `src/validators/paymentValidator.js`
- `src/validators/orderActionValidator.js`
- `src/validators/facilityValidator.js`
- `src/validators/queryValidators.js`
- `src/validators/stripeValidator.js`
- `src/utils/validationUtils.js`

### Extended

- `src/validators/employeeValidator.js` — `validateSuspendEmployee`
- `src/validators/index.js` — exports all validators
- Controllers wired with `throwIfInvalid` / validators (providers, settings, payments, facilities, orders actions, notifications, Stripe public, facility notes/documents)
- `src/services/providerService.js` — search sanitization + control-char stripping on text fields
- `src/services/facilityService.js` — search sanitization
- `src/app.js` — JSON body size limit (2MB)

### Unchanged (by design)

- Service-layer business rules remain as a second line of defense.
- Existing auth, order create/update, and invoice validators were not modified in behavior.
- No raw SQL or route logic was changed.

---

## Testing recommendations

1. Send invalid body to each validated endpoint → expect `400` with `errors[]`.
2. Send oversized JSON (>2MB) → expect parse error.
3. Upload wrong MIME / oversized file → expect `MulterError` or unsupported type message.
4. Use expired JWT → expect `401` with session message.
5. Trigger duplicate DB insert → expect `409` with friendly message.
6. Verify valid requests still succeed (regression on create order, facility, invoice, payment).

---

*Last updated: July 2026*
