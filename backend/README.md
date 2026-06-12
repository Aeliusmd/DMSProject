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

## Next steps

1. Choose a database & ORM (PostgreSQL + Prisma/Sequelize, or MongoDB + Mongoose)
2. Implement models in `src/models/`
3. Add business logic in `src/services/`
4. Wire controllers to services
5. Enable `authenticate` middleware on protected routes
