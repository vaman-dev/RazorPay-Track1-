-- -- ============================================
-- -- MANDATE LEDGER — DATABASE SCHEMA (SQLite)
-- -- ============================================

-- -- 1. INTENT MANDATE
-- -- User/agent ka declared permission — scope + spend cap
-- CREATE TABLE IF NOT EXISTS intents (
--     id              TEXT PRIMARY KEY,        -- UUID
--     scope           TEXT NOT NULL,           -- e.g. "buy running shoes"
--     max_amount      INTEGER NOT NULL,        -- in paise (Razorpay convention)
--     currency        TEXT DEFAULT 'INR',
--     valid_until     DATETIME NOT NULL,
--     signature       TEXT NOT NULL,           -- JWT/HMAC signature
--     status          TEXT DEFAULT 'pending',  -- pending | approved | rejected | expired
--     created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- -- 2. CART MANDATE
-- -- Specific commitment, references an Intent
-- CREATE TABLE IF NOT EXISTS carts (
--     id              TEXT PRIMARY KEY,        -- UUID
--     intent_id       TEXT NOT NULL,           -- FK -> intents.id
--     merchant        TEXT NOT NULL,
--     items           TEXT NOT NULL,           -- JSON string of line items
--     amount          INTEGER NOT NULL,        -- in paise, exact final amount
--     currency        TEXT DEFAULT 'INR',
--     signature       TEXT NOT NULL,
--     status          TEXT DEFAULT 'pending',  -- pending | approved | rejected
--     created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (intent_id) REFERENCES intents(id)
-- );

-- -- 3. PAYMENT MANDATE
-- -- Execution proof, references a Cart, linked to Razorpay
-- CREATE TABLE IF NOT EXISTS payments (
--     id                   TEXT PRIMARY KEY,   -- UUID
--     cart_id              TEXT NOT NULL,      -- FK -> carts.id
--     razorpay_order_id    TEXT,
--     razorpay_payment_id  TEXT,
--     amount               INTEGER NOT NULL,   -- in paise
--     signature            TEXT NOT NULL,
--     status               TEXT DEFAULT 'created', -- created | captured | failed
--     failure_reason        TEXT,               -- populated by Escalation Module
--     created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
--     updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (cart_id) REFERENCES carts(id)
-- );

-- -- 4. AUDIT LOG (append-only ledger)
-- -- Every state change across all three mandates gets logged here
-- CREATE TABLE IF NOT EXISTS audit_log (
--     id              INTEGER PRIMARY KEY AUTOINCREMENT,
--     entity_type     TEXT NOT NULL,           -- intent | cart | payment
--     entity_id       TEXT NOT NULL,
--     event           TEXT NOT NULL,           -- created | approved | rejected | captured | failed
--     detail          TEXT,                    -- human-readable message
--     timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Helpful indexes
-- CREATE INDEX IF NOT EXISTS idx_carts_intent ON carts(intent_id);
-- CREATE INDEX IF NOT EXISTS idx_payments_cart ON payments(cart_id);
-- CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);



-- ============================================
-- MANDATE LEDGER — DATABASE SCHEMA
-- SQLite
-- ============================================


-- ============================================
-- 1. INTENT MANDATE
-- ============================================

CREATE TABLE IF NOT EXISTS intents (

    id              TEXT PRIMARY KEY,

    trace_id        TEXT NOT NULL,

    scope           TEXT NOT NULL,

    max_amount      INTEGER NOT NULL
                    CHECK (max_amount > 0),

    currency        TEXT NOT NULL DEFAULT 'INR',

    valid_until     DATETIME NOT NULL,

    mandate_hash    TEXT NOT NULL,

    signature       TEXT NOT NULL,

    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        status IN (
                            'pending',
                            'approved',
                            'rejected',
                            'expired'
                        )
                    ),

    created_at      DATETIME NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 2. CART MANDATE
-- ============================================

CREATE TABLE IF NOT EXISTS carts (

    id              TEXT PRIMARY KEY,

    trace_id        TEXT NOT NULL,

    intent_id       TEXT NOT NULL,

    merchant        TEXT NOT NULL,

    items           TEXT NOT NULL,

    amount          INTEGER NOT NULL
                    CHECK (amount > 0),

    currency        TEXT NOT NULL DEFAULT 'INR',

    parent_hash     TEXT NOT NULL,

    mandate_hash    TEXT NOT NULL,

    signature       TEXT NOT NULL,

    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        status IN (
                            'pending',
                            'approved',
                            'rejected'
                        )
                    ),

    created_at      DATETIME NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (intent_id)
        REFERENCES intents(id)
);


-- ============================================
-- 3. PAYMENT MANDATE
-- ============================================

CREATE TABLE IF NOT EXISTS payments (

    id                      TEXT PRIMARY KEY,

    trace_id                TEXT NOT NULL,

    cart_id                 TEXT NOT NULL,

    razorpay_order_id       TEXT UNIQUE,

    razorpay_payment_id     TEXT UNIQUE,

    amount                  INTEGER NOT NULL
                            CHECK (amount > 0),

    currency                TEXT NOT NULL DEFAULT 'INR',

    parent_hash             TEXT NOT NULL,

    mandate_hash            TEXT ,

    signature               TEXT ,

    status                  TEXT NOT NULL DEFAULT 'created'
                            CHECK (
                                status IN (
                                    'created',
                                    'pending',
                                    'captured',
                                    'failed'
                                )
                            ),

    failure_code            TEXT,

    failure_detail          TEXT,

    created_at              DATETIME NOT NULL
                            DEFAULT CURRENT_TIMESTAMP,

    updated_at              DATETIME NOT NULL
                            DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cart_id)
        REFERENCES carts(id)
);


-- ============================================
-- 4. APPEND-ONLY AUDIT LEDGER
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (

    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    trace_id            TEXT NOT NULL,

    entity_type         TEXT NOT NULL
                        CHECK (
                            entity_type IN (
                                'intent',
                                'cart',
                                'payment',
                                'webhook'
                            )
                        ),

    entity_id           TEXT NOT NULL,

    event               TEXT NOT NULL,

    previous_status     TEXT,

    new_status          TEXT,

    reason_code         TEXT,

    detail              TEXT,

    metadata            TEXT,

    timestamp           DATETIME NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 5. WEBHOOK IDEMPOTENCY STORE
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_events (

    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    provider            TEXT NOT NULL DEFAULT 'razorpay',

    provider_event_id   TEXT UNIQUE,

    event_type          TEXT NOT NULL,

    payload             TEXT NOT NULL,

    processed           INTEGER NOT NULL DEFAULT 0
                        CHECK (processed IN (0, 1)),

    received_at         DATETIME NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,

    processed_at        DATETIME
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_intents_trace
ON intents(trace_id);

CREATE INDEX IF NOT EXISTS idx_carts_trace
ON carts(trace_id);

CREATE INDEX IF NOT EXISTS idx_carts_intent
ON carts(intent_id);

CREATE INDEX IF NOT EXISTS idx_payments_trace
ON payments(trace_id);

CREATE INDEX IF NOT EXISTS idx_payments_cart
ON payments(cart_id);

CREATE INDEX IF NOT EXISTS idx_audit_trace
ON audit_log(trace_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity
ON audit_log(entity_type, entity_id);