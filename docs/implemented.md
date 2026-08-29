# Mandate Ledger — Implementation Status

**Status:** Foundation implemented; business workflow routes are pending.

## Overview

Mandate Ledger is an Express and SQLite foundation for an auditable, multi-stage payment authorization workflow. The intended workflow is an **Intent → Cart → Payment** chain, with every entity tied together by trace identifiers, hashes, signatures, and audit entries.

## Completed Implementation

### Application runtime

- Configured the project to use **ECMAScript modules** (`"type": "module"`) so the `import` syntax used by the application runs correctly.
- Added the `npm run dev` command using Nodemon and the `npm start` command for standard Node execution.
- Loaded runtime configuration from `.env` with `dotenv`.
- Created an Express application with JSON and URL-encoded request parsing.
- Served static assets from the `public` directory.
- Added a root API endpoint (`GET /`) and database-backed health endpoint (`GET /health`).
- Added structured 404 and global error responses.
- Added graceful shutdown handling for `SIGINT` and `SIGTERM`, closing the HTTP server and SQLite database connection.
- Added diagnostic handlers for HTTP server `close` and `error` events, plus Node process exit logging.

### Database layer

- Connected the application to SQLite through `better-sqlite3`.
- Implemented configurable database location via `DB_PATH`, with a local database as the default.
- Enabled SQLite foreign-key enforcement and WAL journal mode.
- Automatically loads and applies the schema during startup.
- Added a startup database connectivity report.

### Data model

The SQLite schema now defines:

| Component | Implemented capability |
|---|---|
| `intents` | Stores signed spending permissions, scope, caps, currency, validity, status, and trace ID. |
| `carts` | Stores merchant cart commitments linked to an intent, including a parent hash and signature. |
| `payments` | Stores Razorpay order/payment references, payment state, hashes, signatures, and failure details. |
| `audit_log` | Provides an append-only record of lifecycle changes and related metadata. |
| `webhook_events` | Provides persistent webhook event storage and idempotency tracking. |

Indexes are present for trace IDs and relationship fields to support efficient chain and audit lookups.

## Current Routes

| Route | Status | Behaviour |
|---|---|---|
| `GET /` | Implemented | Returns service metadata confirming the API is running. |
| `GET /health` | Implemented | Confirms that the server and SQLite connection are available. |
| All other paths | Implemented fallback | Return a JSON `ROUTE_NOT_FOUND` response. |

## Not Yet Implemented

The project contains placeholders for the next workflow modules, but they are currently empty and are deliberately not mounted by `server.js`:

- Intent creation and signature validation
- Cart creation and spend-cap enforcement
- Razorpay order creation and payment initiation
- Razorpay webhook signature validation and idempotent event processing
- Audit-ledger query service
- Dashboard route and dashboard UI
- Failure escalation logic

## Operational Note

The development server requires an available port. If port `3000` is already used, Node emits `EADDRINUSE` and Nodemon then waits for changes because the process exits. Stop the process using port 3000 or set a different `PORT` value in `.env` before running `npm run dev`.

## Recommended Next Steps

1. Implement and mount `POST /intent`.
2. Implement Cart validation, including intent status, validity, and spend-cap checks.
3. Add the Razorpay adapter and create test-mode orders.
4. Implement signed, idempotent webhooks before connecting the payment workflow to external callbacks.
5. Build ledger queries and expose the audit dashboard.
