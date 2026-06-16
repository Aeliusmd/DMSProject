# DMS Backend API

Node.js + Express REST API following **MVC architecture**, aligned with the DMS frontend modules.

## Folder structure

```
backend/
├── server.js                 # Application entry point
├── package.json
├── .env.example
├── src/
│   ├── app.js                # Express app setup & middleware
│   ├── config/               # Environment & database config
│   ├── controllers/          # Controller — handle HTTP req/res
│   ├── models/               # Model — data schemas & DB access
│   ├── views/                # View — response formatting & email templates
│   │   ├── responses/        # JSON output formatters
│   │   └── emails/           # Email templates (2FA, notifications)
│   ├── routes/               # Route definitions → controllers
│   ├── middleware/           # Auth, validation, errors, uploads
│   ├── services/             # Business logic (used by controllers)
│   ├── validators/           # Request validation rules
│   └── utils/                # Shared helpers (ApiError, logger, etc.)
├── tests/
│   ├── unit/
│   └── integration/
├── uploads/                  # Document storage
│   ├── documents/
│   └── temp/
└── logs/
```

## MVC flow

```
Request → Route → Controller → Service → Model (database)
                      ↓
                    View (format response) → JSON Response
```

| Layer | Responsibility |
|-------|----------------|
| **Model** | Database schemas, queries, data persistence |
| **View** | Response shaping (`views/responses`) and email templates |
| **Controller** | HTTP handling, calls services, returns formatted responses |
| **Routes** | URL mapping to controllers |
| **Services** | Business rules (keeps controllers thin) |

## API routes (prefix `/api`)

| Module | Base path |
|--------|-----------|
| Auth | `/api/auth` |
| Orders | `/api/orders` |
| Facilities | `/api/facilities` |
| Employees | `/api/employees` |
| Invoices | `/api/invoices` |
| Reports | `/api/reports` |
| Notifications | `/api/notifications` |
| Activity log | `/api/activity-log` |
| Settings | `/api/settings` |

## Getting started

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Health check: `GET http://localhost:5000/health`

## Environment

| Variable | Description |
|----------|-------------|
| `FILE_SERVER` | Absolute path where documents are stored (batch scans, orders, facilities) |
| `SUBPOENA_EXTRACTION_API_URL` | Python Subpoena_Extraction service — `POST /process` endpoint |
| `SUBPOENA_EXTRACTION_TIMEOUT_MS` | Max wait for AI extraction (default 300000 ms) |
| `UPLOAD_MAX_FILE_SIZE_MB` | Max PDF upload size (default 50) |

## Batch scan + AI extraction

`POST /api/orders/batch-scan` (multipart)

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Batch PDF with barcode separator sheets |
| `uploadedBy` | Yes | `matrix_employees.id` (until JWT auth is implemented) |

Flow:
1. Saves parent PDF → `{FILE_SERVER}/Order/BatchScan/{userId}/{name}_{userId}_{documentId}.pdf`
2. Calls Subpoena_Extraction `POST /process`
3. Node splits child PDFs → `{documentId}_1.pdf`, `_2.pdf`, …
4. Inserts parent → `unprocessed_subpoenas`, children → `batch_scan_extracts`
5. Writes `activity_logs` row

`GET /api/orders/unprocessed` — list child extracts in queue  
`GET /api/orders/unprocessed/:extractId` — single child + AI fields

Run migration: `database/migrations/001_batch_scan_extracts.sql`  
Seed test employee: `database/seed_dev_minimal.sql`

## Next steps

1. Choose a database & ORM (PostgreSQL + Prisma/Sequelize, or MongoDB + Mongoose)
2. Implement models in `src/models/`
3. Add business logic in `src/services/`
4. Wire controllers to services
5. Enable `authenticate` middleware on protected routes
