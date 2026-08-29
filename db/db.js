import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


// =========================================================
// PATH SETUP
// =========================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =========================================================
// DATABASE PATHS
// =========================================================

const databasePath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, "mandate_ledger.db");

const schemaPath = path.join(__dirname, "schema.sql");


// =========================================================
// CREATE / OPEN DATABASE
// =========================================================

const db = new Database(databasePath);


// =========================================================
// SQLITE CONFIGURATION
// =========================================================

// IMPORTANT:
// SQLite does not always enforce foreign keys unless this
// pragma is enabled.
db.pragma("foreign_keys = ON");

// Better behaviour for local development / concurrent reads.
db.pragma("journal_mode = WAL");


// =========================================================
// LOAD DATABASE SCHEMA
// =========================================================

const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema);

// `CREATE TABLE IF NOT EXISTS` does not add columns to an existing local
// SQLite database. Keep the Core v1.1 migration additive and idempotent.
const intentColumns = db.prepare("PRAGMA table_info(intents)").all();
const intentColumnNames = new Set(intentColumns.map((column) => column.name));

if (!intentColumnNames.has("usage_mode")) {
    db.exec("ALTER TABLE intents ADD COLUMN usage_mode TEXT NOT NULL DEFAULT 'single_use'");
}

if (!intentColumnNames.has("policy_json")) {
    db.exec("ALTER TABLE intents ADD COLUMN policy_json TEXT");
}

db.exec("CREATE INDEX IF NOT EXISTS idx_carts_intent_status ON carts(intent_id, status)");


// =========================================================
// DATABASE CONNECTION TEST
// =========================================================

const foreignKeysEnabled = db
    .prepare("PRAGMA foreign_keys")
    .get();

console.log("========================================");
console.log("Mandate Ledger Database");
console.log("========================================");
console.log("SQLite database connected");
console.log(`Database: ${databasePath}`);
console.log(
    `Foreign Keys: ${
        foreignKeysEnabled.foreign_keys === 1
            ? "ENABLED"
            : "DISABLED"
    }`
);
console.log("Schema initialized");
console.log("========================================");


// =========================================================
// EXPORT
// =========================================================

export default db;
