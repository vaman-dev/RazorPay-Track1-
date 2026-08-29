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